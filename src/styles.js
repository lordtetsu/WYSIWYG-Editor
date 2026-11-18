// Gaya isi dokumen dipakai di editor DAN di halaman cetak (PDF), supaya tampilannya sama.
// Font & ukuran disamakan dengan default di docx.js (Calibri 11pt, spasi 1.5).
export const CONTENT_CSS = `
.de-content{font:11pt/1.5 Calibri,Carlito,Arial,sans-serif;color:#111;outline:none}
.de-content p{margin:0 0 8pt}
.de-content h1,.de-content h2,.de-content h3,.de-content h4,.de-content h5,.de-content h6{margin:12pt 0 6pt;line-height:1.2}
.de-content h1{font-size:20pt}.de-content h2{font-size:16pt}.de-content h3{font-size:13pt}
.de-content h4{font-size:12pt}.de-content h5,.de-content h6{font-size:11pt}
.de-content ul,.de-content ol{margin:0 0 8pt;padding-left:1.5em}
.de-content li>p{margin:0}
.de-content blockquote{margin:0 0 8pt;padding-left:1em;border-left:3px solid #ccc;color:#444}
.de-content pre{margin:0 0 8pt;padding:8px;background:#f4f4f4;white-space:pre-wrap}
.de-content pre,.de-content code{font-family:"Courier New",monospace}
.de-content hr{border:0;border-top:1px solid #999;margin:8pt 0}
.de-content a{color:#0563c1}
.de-content img{max-width:100%;height:auto}
.de-content table{border-collapse:collapse;width:100%;table-layout:fixed;margin:0 0 8pt}
.de-content td,.de-content th{border:1px solid #999;padding:4px 6px;vertical-align:top}
.de-content th{background:#f0f0f0;text-align:left}
.de-content td>:last-child,.de-content th>:last-child{margin-bottom:0}
.de-content ul[data-type="taskList"]{list-style:none;padding-left:0}
.de-content ul[data-type="taskList"] li{display:flex;gap:8px;align-items:flex-start}
.de-content ul[data-type="taskList"] li>label{flex:none;margin-top:.2em}
.de-content ul[data-type="taskList"] li>div{flex:1;min-width:0}
.de-content ul[data-type="taskList"] li[data-checked="true"]>div{text-decoration:line-through;opacity:.7}
.de-content [dir="rtl"]{text-align:right}
.de-content .de-page-break{height:0;margin:0;border:0}
.de-content .de-toc{margin:0 0 12pt}
.de-content .de-toc-title{margin-bottom:6pt}
.de-content .de-toc-item{display:flex;align-items:baseline;gap:4px;margin:0 0 3pt}
.de-content .de-toc-text{flex:1;overflow:hidden;white-space:nowrap}
.de-content .de-toc-text::after{content:" . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . . .";color:#888}
.de-content .de-toc-page{min-width:1.5em;text-align:right}
.de-content .de-toc-empty{color:#888;font-style:italic}
.de-content math{font-family:"Latin Modern Math","STIX Two Math","Cambria Math",math}
.de-content .de-math[data-display]{display:block;text-align:center;margin:0 0 8pt}
.de-content .de-video{margin:0 0 8pt}
.de-content .de-video iframe{display:block;width:100%;aspect-ratio:16/9;border:0}
.de-content .de-video video{display:block;max-width:100%}
.de-content sup.de-fn{font-size:.75em;line-height:0}
.de-footnotes{font-size:9pt;line-height:1.3;margin-top:12pt}
.de-footnotes::before{content:"";display:block;width:33%;border-top:.75pt solid #999;margin:0 0 3pt}
.de-fn-note{margin:0 0 2pt}
.de-page-body .de-footnotes{position:absolute;left:0;right:0;bottom:0;margin:0}
`

// Warna UI lewat variabel CSS --de-* (opsi `theme` atau CSS Anda sendiri); nilai setelah koma adalah default.
export const UI_CSS = `
.de{box-sizing:border-box;border:1px solid var(--de-border,#ccc);border-radius:6px;background:var(--de-bg,#fff);color:var(--de-color,#111)}
.de-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:4px 0;padding:6px 8px;border-bottom:1px solid var(--de-border,#ccc);background:var(--de-toolbar-bg,#fafafa);position:sticky;top:0;z-index:1;border-radius:6px 6px 0 0;font:500 13px/1 var(--de-ui-font,system-ui,sans-serif)}
.de-toolbar button{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-width:var(--de-btn,32px);height:var(--de-btn,32px);padding:0 7px;border:1px solid transparent;border-radius:6px;background:none;color:var(--de-toolbar-color,#222);font:inherit;line-height:1;cursor:pointer;white-space:nowrap}
.de-toolbar button svg{flex:none}
.de-letter{display:inline-block;width:18px;font:17px/18px Georgia,"Times New Roman",serif;text-align:center}
.de-btn-text{font-weight:600}
.de-toolbar [aria-haspopup="menu"]::after{content:"";width:0;height:0;margin-left:-1px;border:4px solid transparent;border-top-color:currentColor;border-bottom:0;opacity:.7}
.de-toolbar button:hover{background:var(--de-hover-bg,#eaeaea)}
.de-toolbar button[aria-pressed="true"]{background:var(--de-active-bg,#dde7ff);border-color:var(--de-active-border,#9bb5f5);color:var(--de-active-color,#1a2b5c)}
.de-toolbar button:focus-visible,.de-pop :focus-visible{outline:2px solid var(--de-accent,#3b6fe0);outline-offset:1px}
.de-toolbar button:disabled{opacity:.35;cursor:default;background:none}
.de-select{height:var(--de-btn,32px);max-width:160px;padding:0 6px;border:1px solid var(--de-border,#ccc);border-radius:6px;background:var(--de-input-bg,var(--de-bg,#fff));color:var(--de-color,#111);font:500 13px var(--de-ui-font,system-ui,sans-serif);cursor:pointer}
.de-blockType{width:112px}.de-fontFamily{width:136px}.de-fontSize{width:76px}
.de-select:focus-visible,.de-color:focus-within{outline:2px solid var(--de-accent,#3b6fe0);outline-offset:1px}
.de-select:disabled{opacity:.35;cursor:default}
.de-color{position:relative;display:inline-flex;align-items:center;justify-content:center;width:var(--de-btn,32px);height:var(--de-btn,32px);border-radius:6px;cursor:pointer;color:var(--de-toolbar-color,#222)}
.de-color:hover{background:var(--de-hover-bg,#eaeaea)}
.de-swatch{display:inline-flex;align-items:center;justify-content:center;height:20px;padding-bottom:1px;border-bottom:4px solid #000;line-height:1}
.de-swatch svg{width:16px;height:16px}
.de-color input{position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;border:0;padding:0}
.de-color:has(input:disabled){opacity:.35;cursor:default}
.de-group{display:flex;flex-wrap:nowrap;align-items:center;gap:2px;padding:0 6px;border-right:1px solid var(--de-border,#ccc)}
.de-group:first-child{padding-left:0}
.de-group:last-child{border-right:0}
.de [hidden]{display:none}
.de-menubar{display:flex;flex-wrap:wrap;gap:2px;padding:4px 6px;border-bottom:1px solid var(--de-border,#ccc);background:var(--de-toolbar-bg,#fafafa);border-radius:6px 6px 0 0;font:500 13px var(--de-ui-font,system-ui,sans-serif)}
.de-menubar+.de-toolbar{border-radius:0}
.de-menubar>button{height:28px;padding:0 10px;border:0;border-radius:5px;background:none;color:var(--de-toolbar-color,#222);font:inherit;cursor:pointer}
.de-menubar>button:hover,.de-menubar>button[aria-expanded="true"]{background:var(--de-hover-bg,#eaeaea)}
.de-menubar>button:focus-visible{outline:2px solid var(--de-accent,#3b6fe0);outline-offset:-1px}
.de-menubar-menu{position:absolute;z-index:30;min-width:240px;max-height:70vh;overflow:auto}
.de .de-menubar-menu button{display:flex;align-items:center;gap:8px;width:100%;height:32px;padding:0 10px;border:0;border-radius:5px;background:none;color:inherit;font:500 13px var(--de-ui-font,system-ui,sans-serif);text-align:left;cursor:pointer}
.de .de-menubar-menu button:hover,.de .de-menubar-menu button:focus{background:var(--de-hover-bg,#eaeaea);outline:none}
.de .de-menubar-menu button:disabled{opacity:.4;cursor:default;background:none}
.de-menu-icon{width:16px;text-align:center;flex:none}
.de-menu-label{flex:1}
.de-menubar-menu kbd{font:12px var(--de-ui-font,system-ui,sans-serif);opacity:.6}
.de-menu-sep{height:1px;margin:4px 6px;background:var(--de-border,#ddd)}
.de-aichat{display:flex;flex-direction:column;flex:none;width:min(360px,45%);border-left:1px solid var(--de-border,#ccc);background:var(--de-bg,#fff);color:var(--de-color,#111);font:14px/1.45 var(--de-ui-font,system-ui,sans-serif);position:sticky;top:0;max-height:100vh}
.de-fixed .de-aichat,.de-fullscreen .de-aichat{position:static;max-height:none}
.de-aichat-head{display:flex;align-items:center;gap:4px;padding:10px 10px 10px 14px;border-bottom:1px solid var(--de-border,#ddd)}
.de-aichat-title{flex:1;margin:0;font-size:16px;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.de-aichat button{display:inline-flex;align-items:center;justify-content:center;gap:5px;border:1px solid transparent;border-radius:6px;background:none;color:inherit;font:inherit;cursor:pointer}
.de-aichat-head button{height:32px;min-width:32px;padding:0 6px}
.de-aichat-head .de-aichat-new{font-weight:600}
.de-aichat button:hover{background:var(--de-hover-bg,#eaeaea)}
.de-aichat button:focus-visible,.de-aichat textarea:focus-visible{outline:2px solid var(--de-accent,#3b6fe0);outline-offset:1px}
.de-aichat-history{display:grid;padding:6px;border-bottom:1px solid var(--de-border,#ddd);max-height:200px;overflow:auto}
.de-aichat-history button{justify-content:flex-start;padding:6px 8px;text-align:left}
.de-aichat-history p{margin:4px 8px;opacity:.7}
.de-aichat-log{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:12px;min-height:160px}
.de-aichat-welcome p{margin:0 0 8px}
.de-aichat-spark{display:block;margin-bottom:14px;color:var(--de-accent,#3b6fe0)}
.de-aichat-spark svg{width:26px;height:26px}
.de-aichat-msg{max-width:92%}
.de-aichat-user{align-self:flex-end;padding:8px 12px;border-radius:12px 12px 2px 12px;background:var(--de-active-bg,#dde7ff);white-space:pre-wrap}
.de-aichat-assistant{align-self:flex-start}
.de-aichat-body>:first-child{margin-top:0}.de-aichat-body>:last-child{margin-bottom:0}
.de-aichat-body table{border-collapse:collapse}.de-aichat-body td,.de-aichat-body th{border:1px solid var(--de-border,#ccc);padding:3px 6px}
.de-aichat-actions{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}
.de-aichat-actions button{height:28px;padding:0 10px;border-color:var(--de-border,#ccc);font-size:12px}
.de-aichat-foot{display:grid;gap:8px;padding:10px 14px 8px;border-top:1px solid var(--de-border,#ddd)}
.de-aichat-chips{display:flex;flex-wrap:wrap;gap:6px}
.de-aichat-chip{height:28px;padding:0 10px;font-size:13px;background:var(--de-toolbar-bg,#f2f4f7)!important}
.de-aichat-chip[aria-pressed="true"]{background:var(--de-active-bg,#dde7ff)!important;border-color:var(--de-active-border,#9bb5f5)!important}
.de-aichat-chip svg{width:15px;height:15px}
.de-aichat-input{display:flex;gap:6px;align-items:flex-end}
.de-aichat-input textarea{flex:1;min-height:40px;max-height:160px;resize:vertical;padding:8px 10px;border:1px solid var(--de-border,#ccc);border-radius:8px;background:var(--de-input-bg,#fff);color:var(--de-color,#111);font:inherit}
.de-aichat .de-aichat-send{width:40px;height:40px;border-radius:8px;background:var(--de-accent,#3b6fe0);color:#fff}
.de-aichat .de-aichat-send:hover{background:var(--de-accent,#3b6fe0);filter:brightness(1.1)}
.de-aichat .de-aichat-send:disabled{opacity:.5;cursor:default}
.de-aichat-status:empty{display:none}
.de-aichat-status{font-size:13px;opacity:.8}
.de-aichat-error{color:#b42318;opacity:1}
.de-aichat-note{text-align:center;opacity:.65;font-size:12px}
@media (max-width:700px){.de-workspace{flex-direction:column}.de-aichat{width:auto;border-left:0;border-top:1px solid var(--de-border,#ccc);max-height:70vh}}
.de-statusbar{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:3px 10px;border-top:1px solid var(--de-border,#ccc);background:var(--de-toolbar-bg,#fafafa);color:var(--de-toolbar-color,#555);font:12px var(--de-ui-font,system-ui,sans-serif);border-radius:0 0 6px 6px}
.de-path{opacity:.75;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.de-count{border:0;background:none;color:inherit;font:inherit;cursor:pointer;padding:2px 4px;border-radius:4px}
.de-count:hover{background:var(--de-hover-bg,#eaeaea)}
.de-find{display:grid;gap:6px;padding:8px;border-bottom:1px solid var(--de-border,#ccc);background:var(--de-toolbar-bg,#fafafa);color:var(--de-toolbar-color,#222);font:13px var(--de-ui-font,system-ui,sans-serif)}
.de-find-row{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.de-find input[type=search],.de-find input[type=text]{flex:1;min-width:160px;height:30px;padding:0 8px;border:1px solid var(--de-border,#ccc);border-radius:5px;background:var(--de-input-bg,#fff);color:var(--de-color,#111);font:inherit}
.de-find button{height:30px;min-width:30px;padding:0 10px;border:1px solid var(--de-border,#ccc);border-radius:5px;background:var(--de-input-bg,#fff);color:var(--de-color,#111);font:inherit;cursor:pointer}
.de-find-case{display:flex;align-items:center;gap:4px}
.de-find-count{min-width:60px;opacity:.75}
.de-fullscreen{position:fixed!important;inset:0;z-index:2147482000;height:auto!important;max-height:none!important;border-radius:0!important;display:flex;flex-direction:column}
.de-fullscreen>.de-workspace{flex:1;min-height:0}
.de-fullscreen .de-workspace>.de-body,.de-fullscreen .de-workspace>.de-code{overflow:auto}
.de-fullscreen .de-body>.de-content{max-width:900px;margin:0 auto;box-sizing:border-box}
html.de-noscroll{overflow:hidden}
.de-toolbar .de-pop.de-chars{grid-template-columns:repeat(10,32px);gap:2px;padding:6px}
.de-toolbar .de-pop.de-chars button{width:32px;height:32px;min-width:0;padding:0;background:none;color:inherit;font:18px/1 system-ui,'Segoe UI Emoji','Apple Color Emoji',sans-serif;filter:none}
.de-toolbar .de-pop.de-chars button:hover,.de-toolbar .de-pop.de-chars button:focus{background:var(--de-hover-bg,#eaeaea)}
.de-pop.de-info{max-width:360px}
.de-pop.de-info p{margin:0}
.de-shortcuts dl{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;margin:8px 0 0}
.de-shortcuts dt{font-weight:600;white-space:nowrap}
.de-shortcuts dd{margin:0}
.de-pop.de-a11y{width:min(420px,90vw)}
.de-a11y ul{display:grid;gap:6px;margin:6px 0 0;padding:0;list-style:none;max-height:300px;overflow:auto}
.de-a11y li{display:flex;align-items:center;gap:6px}
.de-a11y li span{flex:1}
.de-toolbar .de-pop.de-a11y button{height:26px;padding:0 8px;min-width:0;font-size:12px}
.de-ctx,.de-ai{position:fixed;z-index:2147483000;border:1px solid var(--de-border,#ccc);border-radius:6px;background:var(--de-toolbar-bg,#fafafa);color:var(--de-toolbar-color,#222);box-shadow:0 6px 24px rgba(0,0,0,.18);font:13px/1.4 system-ui,sans-serif}
.de-ctx{padding:4px;min-width:200px}
.de-ctx button{display:block;width:100%;padding:8px 10px;border:0;border-radius:4px;background:none;color:inherit;font:inherit;text-align:left;cursor:pointer}
.de-ctx button:hover,.de-ctx button:focus{background:var(--de-hover-bg,#eaeaea);outline:none}
.de-ai{display:grid;gap:8px;width:min(360px,calc(100vw - 16px));padding:12px}
.de-ai textarea{width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--de-border,#ccc);border-radius:4px;font:inherit;resize:vertical}
.de-ai textarea:focus-visible,.de-ai button:focus-visible{outline:2px solid var(--de-accent,#3b6fe0);outline-offset:1px}
.de-ai-status:empty{display:none}
.de-ai-error{color:#b42318}
.de-ai-actions{display:flex;justify-content:flex-end;gap:8px}
.de-ai-actions button{padding:6px 14px;border:1px solid var(--de-border,#ccc);border-radius:4px;background:#fff;color:#111;font:600 13px system-ui,sans-serif;cursor:pointer}
.de-ai-actions .de-primary{background:var(--de-accent,#3b6fe0);border-color:var(--de-accent,#3b6fe0);color:#fff}
.de-ai-actions button:disabled{opacity:.5;cursor:default}
.de-pop{position:absolute;z-index:2;display:grid;gap:8px;padding:12px;min-width:180px;border:1px solid var(--de-border,#ccc);border-radius:6px;background:var(--de-toolbar-bg,#fafafa);color:var(--de-toolbar-color,#222);box-shadow:0 4px 16px rgba(0,0,0,.15);font:13px system-ui,sans-serif}
.de-pop label{display:flex;align-items:center;justify-content:space-between;gap:8px}
.de-pop .de-check{justify-content:flex-start}
.de-pop input[type=number]{width:64px;padding:4px;border:1px solid var(--de-border,#ccc);border-radius:4px;font:inherit}
.de-toolbar .de-pop button{background:var(--de-accent,#3b6fe0);color:#fff}
.de-toolbar .de-pop button:hover{filter:brightness(1.1);background:var(--de-accent,#3b6fe0)}
.de-menu{gap:0;padding:4px;min-width:200px}
.de-toolbar .de-menu button{justify-content:flex-start;width:100%;height:34px;padding:0 10px;background:none;color:inherit;font-weight:500;filter:none}
.de-toolbar .de-menu button::after{content:none}
.de-toolbar .de-menu button:disabled{opacity:.4}
.de-toolbar .de-menu button:hover,.de-toolbar .de-menu button:focus{background:var(--de-hover-bg,#eaeaea);outline:none}
.de-code .cm-editor{min-height:300px;border-radius:0 0 6px 6px;font-size:13px;background:var(--de-bg,#fff)}
.de-code .cm-scroller{min-height:300px}
.de-code .cm-editor.cm-focused{outline:2px solid var(--de-accent,#3b6fe0);outline-offset:-2px}
.de .de-content{min-height:300px;padding:16px 20px;color:var(--de-color,#111)}
.de-fixed{display:flex;flex-direction:column}
.de-fill{height:100%;flex:1 1 0;min-height:0;align-self:stretch}
.de-workspace{display:flex;align-items:stretch;min-width:0}
.de-workspace>.de-body,.de-workspace>.de-code{flex:1;min-width:0}
.de-fixed>.de-workspace{flex:1;min-height:0}
.de-fixed .de-workspace>.de-body,.de-fixed .de-workspace>.de-code{overflow:auto}
.de-fixed .de-content{min-height:100%;box-sizing:border-box}
.de-fixed .de-code .cm-editor{height:100%;min-height:0}
.de-fixed .de-code .cm-scroller{min-height:0}
.de .de-content .selectedCell{background:var(--de-active-bg,#dde7ff)}
.de .de-content th{background:var(--de-th-bg,#f0f0f0)}
.de .de-content pre{background:var(--de-code-bg,#f4f4f4)}
.de .de-content .de-page-break{position:relative;height:0;margin:18px 0;border-top:2px dashed var(--de-border,#bbb)}
.de .de-content .de-page-break.ProseMirror-selectednode{border-top-color:var(--de-accent,#3b6fe0)}
.de .de-content .de-toc{padding:8px 10px;border:1px dashed var(--de-border,#bbb);border-radius:4px;cursor:default}
.de .de-content .de-toc-text::after{content:none}
.de .de-content .de-toc.ProseMirror-selectednode{outline:2px solid var(--de-accent,#3b6fe0)}
.de .ProseMirror{counter-reset:de-fn}
.de .ProseMirror p.is-editor-empty:first-child::before{content:attr(data-placeholder);float:left;height:0;pointer-events:none;color:#8a94a6}
.de .ProseMirror sup.de-fn::after{counter-increment:de-fn;content:counter(de-fn)}
.de .ProseMirror sup.de-fn{color:var(--de-accent,#3b6fe0);cursor:pointer;padding:0 1px}
.de .de-content .de-math{cursor:pointer}
.de .de-content .de-video{padding:6px;border:1px dashed var(--de-border,#bbb);border-radius:4px}
.de .de-content .de-math.ProseMirror-selectednode,.de .de-content .de-video.ProseMirror-selectednode,.de .de-content sup.de-fn.ProseMirror-selectednode{outline:2px solid var(--de-accent,#3b6fe0)}
.de-pop.de-form{display:grid;gap:6px;width:min(380px,90vw)}
.de-pop.de-form textarea,.de-pop.de-form input[type=url]{width:100%;box-sizing:border-box;font:13px/1.4 ui-monospace,Menlo,monospace;padding:6px}
.de-pop.de-form textarea{min-height:64px;resize:vertical}
.de-pop.de-form .de-quick{display:flex;flex-wrap:wrap;gap:4px}
.de-toolbar .de-pop.de-form button:not(.de-primary){background:none;color:inherit;border:1px solid var(--de-border,#ccc)}
.de-toolbar .de-pop.de-form button:not(.de-primary):hover{background:var(--de-hover-bg,#eaeaea);filter:none}
.de-pop.de-form .de-quick button{min-width:32px;height:28px;padding:0 6px}
.de-pop.de-form label{display:flex;gap:6px;align-items:center;justify-self:start}
.de-pop.de-form .de-math-preview{min-height:36px;font-size:18px;text-align:center;padding:6px;border:1px solid var(--de-border,#ccc);border-radius:4px;overflow:auto;background:#fff;color:#111}
.de-pop.de-form .de-form-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}
.de-show-invisibles .de-content p::after,.de-show-invisibles .de-content h1::after,.de-show-invisibles .de-content h2::after,.de-show-invisibles .de-content h3::after,.de-show-invisibles .de-content h4::after{content:"¶";color:#9aa3b5;font-weight:400}
.de-show-invisibles .de-content br::after{content:"↵";color:#9aa3b5}
.de-show-blocks .de-content :is(p,h1,h2,h3,h4,h5,h6,blockquote,pre,ul,ol,li,table){outline:1px dashed #9aa3b5;outline-offset:1px}
.de-find-hit{background:#fff1a8;border-radius:2px}
.de-find-current{background:#ffb347;border-radius:2px;outline:1px solid #c77700}
.de-body.de-has-wm{background-repeat:no-repeat;background-position:center;background-size:contain}
.de-pop .de-wm-fields{min-width:240px}
.de-pop .de-wm-fields label{display:flex;align-items:center;justify-content:space-between;gap:8px}
.de-pop .de-wm-fields input[type=text]{width:140px;padding:4px;border:1px solid var(--de-border,#ccc);border-radius:4px;font:inherit}
.de-toolbar .de-pop .de-wm-fields button{background:#fff;color:#111;border:1px solid var(--de-border,#ccc)}
.de .de-content img.ProseMirror-selectednode,.de .de-content .ProseMirror-selectednode img{outline:2px solid var(--de-accent,#3b6fe0)}
.de .de-content [data-resize-wrapper]{display:inline-block;max-width:100%;line-height:0}
.de .de-content [data-resize-wrapper] img{max-width:100%}
.de .de-content [data-resize-handle]{width:12px;height:12px;margin:-6px;box-sizing:border-box;border:2px solid var(--de-accent,#3b6fe0);border-radius:2px;background:#fff;opacity:0;z-index:1}
.de .de-content [data-resize-container]:hover [data-resize-handle],.de .de-content .ProseMirror-selectednode [data-resize-handle]{opacity:1}
.de .de-content [data-resize-handle="top-left"],.de .de-content [data-resize-handle="bottom-right"]{cursor:nwse-resize}
.de .de-content [data-resize-handle="top-right"],.de .de-content [data-resize-handle="bottom-left"]{cursor:nesw-resize}
`

// Untuk file .html mandiri & cetak/PDF. `page` = hasil normalizePage (mm).
// Di layar lebar isi = lebar area cetak, jadi baris teks terpotong sama seperti di kertas.
export const docCss = ({ width, height, margin: m }) =>
  `@page{size:${width}mm ${height}mm;margin:${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm}body{margin:0}` +
  `@media screen{body{max-width:${width - m.left - m.right}mm;margin:32px auto;padding:0 16px}}` +
  `.de-wm-fixed{position:fixed;inset:0;z-index:-1;pointer-events:none}.de-wm-fixed svg{width:100%;height:100%}` +
  `header.de-content{margin-bottom:12pt}footer.de-content{margin-top:12pt}${CONTENT_CSS}`

// Dokumen per halaman (pratinjau, cetak/PDF, unduhan HTML). Ukuran dalam mm; posisi atas/bawah isi diisi paginate().
export const pagedCss = ({ width, height, margin: m }) => `
@page{size:${width}mm ${height}mm;margin:0}
html,body{margin:0}
.de-source{position:absolute;left:0;top:0;visibility:hidden;width:${width - m.left - m.right}mm}
.de-page{position:relative;width:${width}mm;margin:0 auto;break-after:page;page-break-after:always}
.de-page:last-child{break-after:auto;page-break-after:auto}
.de-sheet{position:relative;width:${width}mm;height:${height}mm;overflow:hidden;background:#fff}
.de-page-body,.de-hf{position:absolute;left:${m.left}mm;width:${width - m.left - m.right}mm}
.de-page-body{overflow:hidden}
.de-page-body img{max-height:100%}
.de-hf>:last-child,.de-page-body>:last-child{margin-bottom:0}
.de-wm{position:absolute;inset:0;pointer-events:none}
.de-wm svg{display:block;width:100%;height:100%}
.de-ruler-h,.de-ruler-v{display:none}
@media screen{
html{background:#e5e7eb}
body{padding:0 24px 24px 56px}
.de-page{margin-bottom:16px}
.de-sheet{box-shadow:0 2px 12px rgba(0,0,0,.2)}
.de-hf[contenteditable]{min-height:5mm;outline:1px dashed transparent;outline-offset:2px;cursor:text}
.de-hf[contenteditable]:hover{outline-color:#9bb5f5}
.de-hf[contenteditable]:focus{outline:2px solid #3b6fe0}
.de-hf[contenteditable]:empty::before{content:attr(data-placeholder);color:#8a94a6;font-style:italic}
.de-ruler-h,.de-ruler-v{display:block;position:relative;font:9px/1 system-ui,sans-serif;color:#555;background-color:#fff;
  --tick:#888;--margin:#d9dde5}
.de-ruler-h{position:sticky;top:0;z-index:5;width:${width}mm;height:18px;margin:0 auto 8px;box-shadow:0 1px 0 #bbb;
  background-image:linear-gradient(to right,var(--margin) ${m.left}mm,transparent ${m.left}mm,transparent ${width - m.right}mm,var(--margin) ${width - m.right}mm),
  repeating-linear-gradient(to right,var(--tick) 0 1px,transparent 1px 10mm),repeating-linear-gradient(to right,var(--tick) 0 1px,transparent 1px 5mm);
  background-size:100% 100%,100% 9px,100% 5px;background-repeat:no-repeat;background-position:0 0,0 100%,0 100%}
.de-ruler-v{position:absolute;left:-26px;top:0;width:18px;height:${height}mm;box-shadow:1px 0 0 #bbb;
  background-image:linear-gradient(to bottom,var(--margin) ${m.top}mm,transparent ${m.top}mm,transparent ${height - m.bottom}mm,var(--margin) ${height - m.bottom}mm),
  repeating-linear-gradient(to bottom,var(--tick) 0 1px,transparent 1px 10mm),repeating-linear-gradient(to bottom,var(--tick) 0 1px,transparent 1px 5mm);
  background-size:100% 100%,9px 100%,5px 100%;background-repeat:no-repeat;background-position:0 0,100% 0,100% 0}
.de-ruler-h span{position:absolute;top:2px;transform:translateX(-50%)}
.de-ruler-v span{position:absolute;left:2px;transform:translateY(-50%)}
}
@media print{.de-hf[contenteditable]:empty::before{content:none}}
${CONTENT_CSS}`

export const MODAL_CSS = `
.de-modal{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(0,0,0,.5);font:13px/1.4 system-ui,sans-serif}
.de-modal-box{display:grid;grid-template-columns:260px 1fr;width:min(1200px,100%);height:100%;overflow:hidden;border-radius:8px;background:var(--de-toolbar-bg,#fafafa);color:var(--de-toolbar-color,#222);box-shadow:0 8px 32px rgba(0,0,0,.3)}
.de-print-settings{display:flex;flex-direction:column;gap:8px;padding:16px;overflow:auto;border-right:1px solid var(--de-border,#ccc)}
.de-print-settings h2{margin:0 0 4px;font-size:16px}
.de-print-settings h3{margin:8px 0 0;font-size:12px;text-transform:uppercase;letter-spacing:.04em;opacity:.75}
.de-print-settings label{display:flex;align-items:center;justify-content:space-between;gap:8px}
.de-print-settings select,.de-print-settings input{font:inherit;padding:4px 6px;border:1px solid var(--de-border,#ccc);border-radius:4px;background:#fff;color:#111}
.de-print-settings select{width:150px}.de-print-settings input{width:80px}
.de-print-settings small{opacity:.75}
.de-print-actions{display:flex;gap:8px;margin-top:auto;padding-top:12px}
.de-print-actions button{flex:1;padding:8px;border:1px solid var(--de-border,#ccc);border-radius:4px;background:#fff;color:#111;font:600 13px system-ui,sans-serif;cursor:pointer}
.de-print-actions .de-primary{background:var(--de-accent,#3b6fe0);border-color:var(--de-accent,#3b6fe0);color:#fff}
.de-modal :focus-visible{outline:2px solid var(--de-accent,#3b6fe0);outline-offset:1px}
.de-print-stage{min-width:0;background:#e5e7eb}
.de-print-stage iframe{display:block;width:100%;height:100%;border:0}
.de-page-count{font-weight:600;opacity:1}
.de-hf-box{display:grid;gap:12px;width:min(820px,100%);max-height:100%;overflow:auto;padding:18px;border-radius:8px;background:var(--de-toolbar-bg,#fafafa);color:var(--de-toolbar-color,#222);box-shadow:0 8px 32px rgba(0,0,0,.3)}
.de-hf-box h2{margin:0;font-size:17px}
.de-hf-box h3{margin:0 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.04em;opacity:.75}
.de-hf-zone{padding:10px;border:1px solid var(--de-border,#ccc);border-radius:6px;background:var(--de-bg,#fff)}
.de-hf-bar{display:flex;flex-wrap:wrap;gap:2px;margin-bottom:6px}
.de-hf-bar button{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;padding:0 6px;border:1px solid transparent;border-radius:5px;background:none;color:inherit;font:600 13px var(--de-ui-font,system-ui,sans-serif);cursor:pointer}
.de-hf-bar button:hover{background:var(--de-hover-bg,#eaeaea)}
.de-hf-bar button[aria-pressed="true"]{background:var(--de-active-bg,#dde7ff);border-color:var(--de-active-border,#9bb5f5)}
.de-hf-edit{min-height:56px;padding:6px 8px;border:1px dashed var(--de-border,#bbb);border-radius:4px}
.de-hf-edit .de-content{outline:none;min-height:44px}
.de-hf-edit img{max-height:80px;width:auto}
.de-hf-fields{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:8px}
.de-hf-fields label,.de-hf-first{display:flex;align-items:center;gap:8px}
.de-hf-box input[type=text],.de-hf-box input[type=number]{padding:4px 6px;border:1px solid var(--de-border,#ccc);border-radius:4px;background:var(--de-input-bg,#fff);color:var(--de-color,#111);font:inherit}
.de-hf-box input[type=text]{width:150px}.de-hf-box input[type=number]{width:80px}
.de-hf-box small{opacity:.75}
.de-crop-box{display:grid;grid-template-columns:1fr 260px;width:min(1100px,100%);max-height:100%;overflow:hidden;border-radius:8px;background:var(--de-toolbar-bg,#fafafa);color:var(--de-toolbar-color,#222);box-shadow:0 8px 32px rgba(0,0,0,.3)}
.de-crop-stage{position:relative;align-self:center;justify-self:center;margin:16px;line-height:0;user-select:none;touch-action:none}
.de-crop-stage img{display:block;max-width:100%;max-height:calc(100vh - 80px)}
.de-crop-rect{position:absolute;box-sizing:border-box;border:2px solid #fff;outline:1px solid rgba(0,0,0,.6);box-shadow:0 0 0 9999px rgba(0,0,0,.5);cursor:move}
.de-crop-stage{overflow:hidden}
.de-crop-rect:focus-visible{outline:3px solid var(--de-accent,#3b6fe0)}
.de-crop-handle{position:absolute;width:14px;height:14px;margin:-8px;border:2px solid var(--de-accent,#3b6fe0);border-radius:2px;background:#fff}
.de-crop-nw{left:0;top:0;cursor:nwse-resize}.de-crop-se{right:0;bottom:0;cursor:nwse-resize}
.de-crop-ne{right:0;top:0;cursor:nesw-resize}.de-crop-sw{left:0;bottom:0;cursor:nesw-resize}
.de-crop-side{display:flex;flex-direction:column;gap:8px;padding:16px;border-left:1px solid var(--de-border,#ccc);overflow:auto}
.de-crop-side h2{margin:0 0 4px;font-size:16px}
.de-crop-side label{display:flex;align-items:center;justify-content:space-between;gap:8px}
.de-crop-side input,.de-crop-side select{width:100px;padding:4px 6px;border:1px solid var(--de-border,#ccc);border-radius:4px;font:inherit}
.de-crop-side>button{padding:6px;border:1px solid var(--de-border,#ccc);border-radius:4px;background:#fff;font:inherit;cursor:pointer}
.de-crop-side small{opacity:.75}
.de-crop-error{margin:0;color:#b42318}
.de-crop-error:empty{display:none}
@media (max-width:700px){.de-crop-box{grid-template-columns:1fr}.de-crop-side{border-left:0;border-top:1px solid var(--de-border,#ccc)}}
.de-wm-fields{display:grid;gap:8px}
.de-wm-fields input[type=text]{width:150px}
.de-wm-fields input[type=color]{width:44px;height:26px;padding:0}
.de-wm-fields input[type=range]{width:110px;padding:0}
.de-wm-fields .de-secondary{padding:6px;border:1px solid var(--de-border,#ccc);border-radius:4px;background:#fff;color:#111;font:inherit;cursor:pointer}
@media (max-width:700px){.de-modal-box{grid-template-columns:1fr;grid-template-rows:auto 1fr}.de-print-settings{border-right:0;border-bottom:1px solid var(--de-border,#ccc);max-height:45vh}}
`
