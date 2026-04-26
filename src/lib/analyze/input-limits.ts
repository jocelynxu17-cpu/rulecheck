/** Byte limits for /api/analyze — no OCR/PDF deps so the text path can import this alone. */
export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PDF_MAX_BYTES = 20 * 1024 * 1024;
/** 與 PDF 擷取／扣點一致之上限 */
export const PDF_MAX_PAGES = 50;
