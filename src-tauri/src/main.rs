#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};

use tauri::Emitter;
use walkdir::WalkDir;

#[derive(Serialize, Deserialize, Debug, Clone)]
struct CompressionOptions {
    mode: String,
    quality: u8,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct CompressionResult {
    file_path: String,
    original_size: u64,
    compressed_size: u64,
    saved_before: u64,
    status: String,
    error: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
struct ProgressEvent {
    done: usize,
    total: usize,
    result: CompressionResult,
}

#[tauri::command]
async fn scan_paths(paths: Vec<String>) -> Vec<String> {
    let mut results: Vec<String> = Vec::new();
    let supported_extensions = vec!["jpg", "jpeg", "png"];

    for p in paths {
        let path = Path::new(&p);
        if path.is_dir() {
            for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    let ext = entry
                        .path()
                        .extension()
                        .and_then(|s| s.to_str())
                        .unwrap_or("")
                        .to_lowercase();
                    if supported_extensions.contains(&ext.as_str()) {
                        results.push(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        } else if path.is_file() {
            let ext = path
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_lowercase();
            if supported_extensions.contains(&ext.as_str()) {
                results.push(path.to_string_lossy().to_string());
            }
        }
    }
    results
}

#[tauri::command]
async fn compress_files(
    app: tauri::AppHandle,
    paths: Vec<String>,
    options: CompressionOptions,
) -> Result<(), String> {
    let total = paths.len();
    let done = Arc::new(Mutex::new(0));

    // Process files in parallel using rayon
    paths.par_iter().for_each(|file_path| {
        let path = Path::new(file_path);
        let result = process_single_file(path, &options);

        let mut done_lock = done.lock().unwrap();
        *done_lock += 1;
        let current_done = *done_lock;

        // Emit progress event
        // Note: Generic error handling here because Emitter can fail if window is closed
        let _ = app.emit(
            "compression-progress",
            ProgressEvent {
                done: current_done,
                total,
                result: result.clone(),
            },
        );
    });

    Ok(())
}

fn process_single_file(path: &Path, options: &CompressionOptions) -> CompressionResult {
    let file_path_str = path.to_string_lossy().to_string();
    
    // Get original size
    let metadata = match fs::metadata(path) {
        Ok(m) => m,
        Err(e) => return create_error_result(&file_path_str, &e.to_string()),
    };
    let original_size = metadata.len();
    let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
    let mut compressed_data: Vec<u8> = Vec::new();

    // Compression Logic
    let compression_result = match ext.as_str() {
        "png" => {
            let input_data = match fs::read(path) {
                Ok(d) => d,
                Err(e) => return create_error_result(&file_path_str, &format!("Failed to read file: {}", e)),
            };

            println!("DEBUG: Processing mode={}, quality={}", options.mode, options.quality);
            if options.mode == "lossy" {
                // Advanced Lossy Compression: imagequant -> png crate -> oxipng
                println!("DEBUG: Starting lossy compression pipeline...");
                // 1. Load and prepare image
                let img = match image::open(path) {
                    Ok(i) => i,
                    Err(e) => return create_error_result(&file_path_str, &format!("Failed to open image: {}", e)),
                };
                let img_rgba = img.to_rgba8();
                let width = img.width() as usize;
                let height = img.height() as usize;

                // 2. Quantize
                let quant_result = (|| -> Result<Vec<u8>, String> {
                    let mut attr = imagequant::Attributes::new();
                    let q = options.quality;
                    // Quality range logic: 
                    // To give users more control:
                    // High quality (e.g. 90) -> min 60. Forces algorithm to fail if visual loss is too high.
                    // Low quality (e.g. 40) -> min 0. Allows heavy compression.
                    // This makes the slider feel more responsive to "quality requirements".
                    let min_q = if q > 30 { q - 30 } else { 0 };
                    attr.set_quality(min_q, q).map_err(|e| format!("IQ Quality err: {:?}", e))?;
                    
                    println!("DEBUG: ImageQuant config quality={}-{}", min_q, q);

                    // Convert raw bytes to RGBA slice using bytemuck
                    let rgba_slice: &[rgb::RGBA8] = bytemuck::cast_slice(img_rgba.as_raw());
                    
                    let mut iq_image = attr.new_image_borrowed(rgba_slice, width, height, 0.0)
                        .map_err(|e| format!("IQ NewImage err: {:?}", e))?;
                    
                    let mut quant = attr.quantize(&mut iq_image)
                        .map_err(|e| format!("IQ Quantize err: {:?}", e))?;
                    
                    quant.set_dithering_level(1.0).map_err(|e| format!("IQ Dither err: {:?}", e))?;
                    
                    let (palette, pixels): (Vec<imagequant::RGBA>, Vec<u8>) = quant.remapped(&mut iq_image)
                        .map_err(|e| format!("IQ Remap err: {:?}", e))?;
                    
                    // 3. Encode with png crate
                    let mut buffer = Vec::new();
                    let mut cursor = std::io::Cursor::new(&mut buffer);
                    {
                        let mut encoder = png::Encoder::new(&mut cursor, width as u32, height as u32);
                        encoder.set_color(png::ColorType::Indexed);
                        encoder.set_depth(png::BitDepth::Eight);
                        
                        // Prepare PLTE (RGB) and tRNS (A)
                        let mut plte: Vec<u8> = Vec::with_capacity(palette.len() * 3);
                        let mut trns: Vec<u8> = Vec::with_capacity(palette.len());
                        let mut has_transparency = false;
                        
                        for px in &palette {
                            plte.push(px.r);
                            plte.push(px.g);
                            plte.push(px.b);
                            trns.push(px.a);
                            if px.a < 255 { has_transparency = true; }
                        }
                        
                        encoder.set_palette(plte);
                        if has_transparency {
                            encoder.set_trns(trns);
                        }
                        
                        let mut writer = encoder.write_header().map_err(|e| format!("PNG Header err: {}", e))?;
                        writer.write_image_data(&pixels).map_err(|e| format!("PNG Write err: {}", e))?;
                    }
                    
                    Ok(buffer)
                })();

                match quant_result {
                    Ok(data) => {
                         // 4. Final optimization with oxipng
                         let mut oxi_options = oxipng::Options::from_preset(2);
                         oxi_options.strip = oxipng::StripChunks::All; 
                         match oxipng::optimize_from_memory(&data, &oxi_options) {
                             Ok(final_data) => { compressed_data = final_data; Ok(()) },
                             Err(e) => {
                                 println!("[Compress] Oxipng failed on quant result: {}, using lodepng raw.", e);
                                 compressed_data = data;
                                 Ok(())
                             }
                         }
                    },
                    Err(e) => {
                        println!("[Compress] Lossy failed: {}, falling back to lossless.", e);
                        // Fallback to lossless logic if quantization fails (e.g. image too simple or opaque)
                        let oxi_options = oxipng::Options::from_preset(2);
                        match oxipng::optimize_from_memory(&input_data, &oxi_options) {
                            Ok(data) => { compressed_data = data; Ok(()) },
                            Err(e) => Err(format!("PNG optimization failed: {}", e))
                        }
                    }
                }
            } else {
                // Lossless mode (existing logic)
                let mut oxi_options = oxipng::Options::from_preset(2); 
                oxi_options.strip = oxipng::StripChunks::Safe;
                match oxipng::optimize_from_memory(&input_data, &oxi_options) {
                    Ok(data) => {
                        compressed_data = data;
                        Ok(())
                    },
                    Err(e) => Err(format!("PNG optimization failed: {}", e))
                }
            }
        },
        "jpg" | "jpeg" => {
            // JPEG Process using image crate
             let img = match image::open(path) {
                Ok(i) => i,
                Err(e) => return create_error_result(&file_path_str, &format!("Failed to open image: {}", e)),
            };
            
            let quality = if options.mode == "lossless" { 100 } else { options.quality };
            println!("DEBUG: JPEG compression with quality={}", quality);

            let mut writer = std::io::Cursor::new(Vec::new());
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(&mut writer, quality);
            
            match encoder.encode_image(&img) {
                Ok(_) => {
                    compressed_data = writer.into_inner();
                    Ok(())
                },
                Err(e) => Err(format!("JPEG encoding failed: {}", e))
            }
        },
        _ => Err("Unsupported format".to_string())
    };

    if let Err(e) = compression_result {
         return create_error_result(&file_path_str, &e);
    }

    let compressed_size = compressed_data.len() as u64;

    println!("[Compress] {} - Original: {} -> Compressed: {}", file_path_str, original_size, compressed_size);

    // Save Logic
    // We strictly save if size is smaller. 
    // If size is larger, we keep original (effectively skipping), unless user explicitly wanted re-encode (but usually size increase is bad).
    if compressed_size < original_size {
        if let Err(e) = fs::write(path, &compressed_data) {
             return create_error_result(&file_path_str, &format!("Failed to save: {}", e));
        }
        
        CompressionResult {
            file_path: file_path_str,
            original_size: original_size,
            compressed_size: compressed_size,
            saved_before: original_size - compressed_size,
            status: "success".to_string(),
            error: None,
        }
    } else {
        // Did not save because it got bigger or same
        CompressionResult {
             file_path: file_path_str,
            original_size: original_size,
            compressed_size: original_size,
            saved_before: 0,
            status: "success".to_string(),
            error: None,
        }
    }
}

fn create_error_result(path: &str, error: &str) -> CompressionResult {
    CompressionResult {
        file_path: path.to_string(),
        original_size: 0,
        compressed_size: 0,
        saved_before: 0,
        status: "error".to_string(),
        error: Some(error.to_string()),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![scan_paths, compress_files])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
