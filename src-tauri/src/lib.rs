/* Project Budget desktop shell.
 *
 * The app is the same static site the browser gets: Eleventy builds _site,
 * Tauri serves it from a custom scheme, and everything still runs in the
 * page. There is no Rust-side business logic and there should not be -- the
 * store, the schema and the migrations live in JS and are shared with the
 * web build, so a divergence here would be a second source of truth for
 * someone's finances.
 *
 * Two plugins are registered because the web app cannot do these things
 * inside a WebView:
 *
 *   dialog + fs  Export writes a file. In a browser that is
 *                URL.createObjectURL plus a synthetic <a download>, which a
 *                WebView has no download manager for -- the click simply
 *                does nothing. These give the export path a real save
 *                dialog. This is the app's whole data-safety story, so it
 *                is the first thing to verify on any new platform.
 *   opener       "View source on GitHub" and similar must open in the
 *                user's browser, not navigate the app window away from
 *                itself with no way back.
 */

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Project Budget");
}
