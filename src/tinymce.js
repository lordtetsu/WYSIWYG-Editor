// Lapisan kompatibel TinyMCE: kode yang memakai tinymce.init({...}), tinymce.get(), editor.getContent(), dst.
// berjalan di atas DocEditor.create() tanpa diubah. Yang belum didukung diberi peringatan di konsol.
import { DOMSerializer } from '@tiptap/pm/model'
import { LOCALES } from './locales.js'

/** Nama tombol TinyMCE -> nama tombol doc-editor. */
export const TOOLBAR_MAP = {
  undo: 'undo', redo: 'redo',
  blocks: 'blockType', formatselect: 'blockType', styles: 'blockType', styleselect: 'blockType',
  fontfamily: 'fontFamily', fontselect: 'fontFamily', fontsize: 'fontSize', fontsizeselect: 'fontSize', fontsizeinput: 'fontSize',
  bold: 'bold', italic: 'italic', underline: 'underline', strikethrough: 'strike', superscript: 'superscript', subscript: 'subscript',
  forecolor: 'textColor', backcolor: 'highlight', removeformat: 'clearFormat', casechange: 'changeCase', formatpainter: 'formatPainter',
  alignleft: 'alignLeft', aligncenter: 'alignCenter', alignright: 'alignRight', alignjustify: 'alignJustify', alignnone: 'alignLeft',
  lineheight: 'lineHeight', outdent: 'outdent', indent: 'indent', ltr: 'ltr', rtl: 'rtl',
  bullist: 'bulletList', numlist: 'orderedList', checklist: 'taskList', blockquote: 'blockquote',
  link: 'link', image: 'image', media: 'video', table: 'table', hr: 'horizontalRule', pagebreak: 'pageBreak', toc: 'toc',
  charmap: 'specialChar', emoticons: 'emoji', mergetags: 'mergeTags', template: 'templates', inserttemplate: 'templates',
  footnotes: 'footnote', math: 'math', tinymcemath: 'math',
  code: 'code', fullscreen: 'fullscreen', preview: 'print', print: 'print', save: 'save',
  spellchecker: 'spellcheck', spellcheckdialog: 'spellcheck', a11ycheck: 'a11yCheck', accessibility: 'a11yCheck',
  aidialog: 'aiChat', aishortcuts: 'aiChat', export: 'exportMenu', exportword: 'exportMenu', exportpdf: 'exportMenu', importword: 'importMenu',
}

// Tombol TinyMCE yang di doc-editor hanya ada di menu: dibuat sebagai tombol kustom berlabel bawaan.
const EXTRA = {
  searchreplace: ['find', (a) => a.openFind()],
  unlink: ['unlink', (a) => a.editor.chain().focus().unsetLink().run()],
  visualblocks: ['showBlocks', (a) => a.toggleBlocks()],
  visualchars: ['showInvisibles', (a) => a.toggleInvisibles()],
  wordcount: ['wordCount', (a) => a.showWordCount()],
  insertdatetime: ['dateLong', (a) => a.insertDateTime('date')],
  codesample: ['codeSample', (a) => a.editor.chain().focus().toggleCodeBlock().run()],
  restoredraft: ['restoreDraft', (a) => a.restoreDraft()],
  newdocument: ['newDocument', (a) => a.newDocument()],
  selectall: ['selectAll', (a) => a.editor.chain().focus().selectAll().run()],
  help: ['shortcuts', (a) => a.showShortcuts()],
}

const MENU_KEYS = ['file', 'edit', 'view', 'insert', 'format', 'tools', 'table', 'help']
// Opsi TinyMCE yang tidak berpengaruh di sini (sudah bawaan, atau khusus layanan TinyMCE): diabaikan tanpa peringatan.
const IGNORED = new Set(['plugins', 'external_plugins', 'branding', 'promotion', 'license_key', 'api_key', 'skin_url', 'language_url', 'toolbar_mode',
  'toolbar_sticky', 'toolbar_sticky_offset', 'relative_urls', 'remove_script_host', 'convert_urls', 'document_base_url', 'entity_encoding',
  'paste_data_images', 'paste_as_text', 'image_advtab', 'image_caption', 'image_title', 'image_dimensions', 'automatic_uploads', 'resize',
  'elementpath', 'contextmenu', 'quickbars_selection_toolbar', 'quickbars_insert_toolbar', 'browser_spellcheck', 'object_resizing',
  'table_default_attributes', 'table_default_styles', 'importcss_append', 'autosave_ask_before_unload', 'autosave_interval', 'autosave_retention',
  'autosave_restore_when_empty', 'images_file_types', 'file_picker_types', 'image_list', 'link_list', 'link_default_target', 'min_height', 'max_height',
  'autoresize_bottom_margin', 'menu', 'mobile', 'icons', 'icons_url', 'theme', 'model', 'base_url', 'suffix', 'cache_suffix', 'deprecation_warnings',
  'selector', 'target', 'setup', 'init_instance_callback', 'width'])
// Opsi asli doc-editor yang boleh ditulis langsung di konfigurasi tinymce.init (mis. page, ai, allowExport).
const NATIVE = new Set(['page', 'ai', 'allowExport', 'theme', 'density', 'fileName', 'onChange', 'onSave', 'labels', 'autosave', 'spellcheck',
  'templates', 'mergeTags', 'fonts', 'fontSizes', 'contentCss', 'imageUpload', 'placeholder', 'readonly', 'lang', 'content', 'toolbar', 'menubar', 'statusbar', 'height'])

const list = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/[\s,]+/)).filter(Boolean)
// "Arial=arial,helvetica,sans-serif; Courier New=courier new,courier" -> ['arial,helvetica,sans-serif', …]
const fontFormats = (v) => String(v).split(';').map((p) => p.split('=').pop().trim()).filter(Boolean)
// "8pt 10pt 12px" -> [8, 10, 9] (pt)
const sizeFormats = (v) => list(v).map((s) => (/px$/i.test(s) ? (parseFloat(s) * 72) / 96 : parseFloat(s))).filter((n) => n > 0)

/** toolbar TinyMCE (string, array string/objek, toolbar1..n, false) -> { groups, buttons } doc-editor. */
export function toolbarFrom(config) {
  let src = config.toolbar
  if (src === undefined) {
    const rows = Object.keys(config).filter((k) => /^toolbar\d+$/.test(k)).sort().map((k) => config[k])
    src = rows.length ? rows : undefined
  }
  if (src === undefined || src === true) return {}
  if (typeof src === 'object' && !Array.isArray(src)) return { native: src } // opsi toolbar asli doc-editor
  if (src === false || src === '') return { groups: [] }
  const rows = Array.isArray(src) ? src : [src]
  const groups = []
  const buttons = {}
  const unknown = []
  for (const row of rows) {
    const parts = typeof row === 'object' ? [list(row.items).join(' ')] : String(row).split('|')
    for (const part of parts) {
      const keys = []
      for (const name of list(part)) {
        if (TOOLBAR_MAP[name]) keys.push(TOOLBAR_MAP[name])
        else if (EXTRA[name]) { keys.push(name); buttons[name] = EXTRA[name] }
        else if (config.__custom?.has(name)) keys.push(name)
        else unknown.push(name)
      }
      if (keys.length) groups.push(keys)
    }
  }
  return { groups, buttons, unknown }
}

/** Konfigurasi tinymce.init -> opsi DocEditor.create (tanpa setup/callback). */
export function optionsFrom(config) {
  const o = {}
  const warn = []
  for (const [k, v] of Object.entries(config)) {
    if (k.startsWith('__') || IGNORED.has(k) || /^toolbar\d+$/.test(k)) continue
    switch (k) {
      case 'language': o.lang = /^id/i.test(v) ? 'id' : 'en'; break
      case 'height': o.height = typeof v === 'number' || /^\d+$/.test(v) ? +v : v; break
      case 'menubar': o.menubar = typeof v === 'string' ? list(v).filter((m) => MENU_KEYS.includes(m)) : v; break
      case 'statusbar': o.statusbar = v; break
      case 'placeholder': o.placeholder = v; break
      case 'readonly': case 'disabled': o.readonly = !!v; break
      case 'skin': if (/dark/.test(v)) o.theme = 'dark'; break
      case 'content_css': {
        const urls = list(v).filter((u) => !/^(default|dark|document|writer|tinymce-5(-dark)?)$/.test(u))
        if (urls.length) o.contentCss = [...(o.contentCss ?? []), ...urls]
        break
      }
      case 'content_style': o.contentCss = [...(o.contentCss ?? []), v]; break
      case 'font_family_formats': case 'font_formats': o.fonts = fontFormats(v); break
      case 'font_size_formats': case 'fontsize_formats': o.fontSizes = sizeFormats(v); break
      case 'spellchecker_active': o.spellcheck = !!v; break
      case 'templates': o.templates = v.map((t) => ({ title: t.title, html: t.content ?? '' })); break
      case 'mergetags_list': {
        const flat = (items) => items.flatMap((i) => (i.menu ? flat(i.menu) : [{ value: i.value, label: i.title ?? i.value }]))
        o.mergeTags = flat(v)
        break
      }
      case 'autosave_prefix': o.autosave = v; break
      case 'statusbar_wordcount': break
      case 'toolbar': break // diproses toolbarFrom
      case 'save_onsavecallback': case 'images_upload_handler': case 'images_upload_url': case 'images_upload_credentials': case 'images_upload_base_path': break // diproses init()
      default:
        if (NATIVE.has(k)) o[k] = v
        else warn.push(k)
    }
  }
  if (list(config.plugins).includes('autosave') && o.autosave == null) o.autosave = true
  if (list(config.plugins).includes('autoresize')) delete o.height
  return { options: o, warn }
}

// Perintah execCommand TinyMCE -> aksi doc-editor.
const MARKS = { Bold: 'bold', Italic: 'italic', Underline: 'underline', Strikethrough: 'strike', Superscript: 'superscript', Subscript: 'subscript' }
const ALIGN = { JustifyLeft: 'left', JustifyCenter: 'center', JustifyRight: 'right', JustifyFull: 'justify' }
const TOOLS = { Indent: 'indent', Outdent: 'outdent', RemoveFormat: 'clearFormat', mceCodeEditor: 'code', mceFullScreen: 'fullscreen', mcePreview: 'print',
  mcePrint: 'print', mceImage: 'image', mceLink: 'link', mceMedia: 'video', mceCharMap: 'specialChar', mceEmoticons: 'emoji', mceInsertToc: 'toc',
  mceTableProps: 'table', mceInsertTableDialog: 'table', mceFormatPainter: 'formatPainter', mceA11yCheck: 'a11yCheck' }
const TABLE_CMDS = { mceTableInsertRowAfter: 'addRowAfter', mceTableInsertRowBefore: 'addRowBefore', mceTableInsertColAfter: 'addColumnAfter',
  mceTableInsertColBefore: 'addColumnBefore', mceTableDeleteRow: 'deleteRow', mceTableDeleteCol: 'deleteColumn', mceTableDelete: 'deleteTable',
  mceTableMergeCells: 'mergeCells', mceTableSplitCells: 'splitCell', mceTableToggleHeaderRow: 'toggleHeaderRow' }

function runCommand(api, cmd, value) {
  const e = api.editor
  const c = () => e.chain().focus()
  if (MARKS[cmd]) return c().toggleMark(MARKS[cmd]).run()
  if (ALIGN[cmd]) return c().setTextAlign(ALIGN[cmd]).run()
  if (TOOLS[cmd]) return api.runTool(TOOLS[cmd])
  if (TABLE_CMDS[cmd]) return c()[TABLE_CMDS[cmd]]().run()
  switch (cmd) {
    case 'Undo': return c().undo().run()
    case 'Redo': return c().redo().run()
    case 'SelectAll': return c().selectAll().run()
    case 'Delete': return c().deleteSelection().run()
    case 'InsertUnorderedList': return c().toggleBulletList().run()
    case 'InsertOrderedList': return c().toggleOrderedList().run()
    case 'mceBlockQuote': return c().toggleBlockquote().run()
    case 'InsertHorizontalRule': return c().setHorizontalRule().run()
    case 'InsertLineBreak': return c().setHardBreak().run()
    case 'mceInsertContent': case 'mceReplaceContent': case 'InsertHTML': return c().insertContent(value ?? '').run()
    case 'mceSetContent': return e.commands.setContent(value ?? '', { emitUpdate: true })
    case 'mceInsertTable': return typeof value === 'object' && value ? c().insertTable({ rows: +value.rows || 2, cols: +value.columns || 2, withHeaderRow: true }).run() : api.runTool('table')
    case 'CreateLink': case 'mceInsertLink': return c().extendMarkRange('link').setLink({ href: typeof value === 'object' ? value.href : value }).run()
    case 'Unlink': return c().unsetLink().run()
    case 'FontName': return c().setFontFamily(value).run()
    case 'FontSize': return c().setFontSize(/^\d+(\.\d+)?$/.test(String(value)) ? `${value}pt` : value).run()
    case 'ForeColor': return c().setColor(value).run()
    case 'HiliteColor': case 'BackColor': return c().setBackgroundColor(value).run()
    case 'LineHeight': return api.editor.chain().focus().updateAttributes('paragraph', { lineHeight: String(value) }).run()
    case 'FormatBlock': case 'mceToggleFormat': {
      const v = String(value ?? '').toLowerCase()
      const mark = { bold: 'bold', italic: 'italic', underline: 'underline', strikethrough: 'strike', superscript: 'superscript', subscript: 'subscript' }[v]
      if (mark) return c().toggleMark(mark).run()
      if (/^h[1-6]$/.test(v)) return c().setHeading({ level: +v[1] }).run()
      if (v === 'pre') return c().setCodeBlock().run()
      if (v === 'blockquote') return c().toggleBlockquote().run()
      return c().setParagraph().run()
    }
    case 'mceSave': return api.save()
    case 'mceSearchReplace': return api.openFind()
    case 'mceWordCount': return api.showWordCount()
    case 'mceVisualBlocks': return api.toggleBlocks()
    case 'mceVisualChars': return api.toggleInvisibles()
    case 'mceNewDocument': return api.newDocument()
    case 'mceInsertDate': return api.insertDateTime('date')
    case 'mceInsertTime': return api.insertDateTime('time')
    default:
      console.warn(`DocEditor (tinymce): execCommand "${cmd}" belum didukung`)
      return false
  }
}

// Peristiwa TinyMCE -> sumber peristiwa di doc-editor.
const TIPTAP_EVENTS = { input: 'update', change: 'update', nodechange: 'selectionUpdate', selectionchange: 'selectionUpdate', focus: 'focus', blur: 'blur' }
const DOM_EVENTS = new Set(['keydown', 'keyup', 'keypress', 'click', 'dblclick', 'mousedown', 'mouseup', 'paste', 'copy', 'cut', 'contextmenu', 'drop', 'dragover'])

let uid = 0

/** Objek editor bergaya TinyMCE. Dibuat sebelum init agar setup(editor) bisa mendaftarkan tombol & peristiwa. */
function makeEditor(manager, el, config) {
  const handlers = new Map() // nama kecil -> Set(fn)
  const custom = {}
  const icons = {}
  let api = null
  let dirty = false
  const need = () => {
    if (!api) throw new Error('DocEditor (tinymce): editor belum siap; gunakan editor.on("init", …)')
    return api
  }
  const fire = (name, args = {}) => {
    const ev = { type: name, target: ed, ...args }
    for (const fn of [...(handlers.get(name.toLowerCase()) ?? [])]) fn.call(ed, ev)
    return ev
  }
  const ed = {
    id: el.id || `mce_${uid++}`,
    targetElm: el,
    settings: config,
    initialized: false,
    options: { get: (k) => config[k], isSet: (k) => k in config },
    getParam: (k, fallback) => (k in config ? config[k] : fallback),
    on(names, fn) {
      for (const n of list(names)) {
        const key = n.toLowerCase()
        if (!handlers.has(key)) handlers.set(key, new Set())
        handlers.get(key).add(fn)
        if (api) bind(key)
      }
      return ed
    },
    off(names, fn) {
      for (const n of list(names)) fn ? handlers.get(n.toLowerCase())?.delete(fn) : handlers.delete(n.toLowerCase())
      return ed
    },
    once(names, fn) {
      const wrap = function (e) { ed.off(names, wrap); return fn.call(this, e) }
      return ed.on(names, wrap)
    },
    fire,
    dispatch: fire,
    ui: {
      registry: {
        addButton: (name, spec) => { custom[name] = spec },
        addToggleButton: (name, spec) => { custom[name] = { ...spec, toggle: true } },
        addIcon: (name, svg) => { icons[name] = svg },
        addMenuButton: (name) => console.warn(`DocEditor (tinymce): addMenuButton "${name}" belum didukung; gunakan addButton`),
        addMenuItem: () => {},
        addContextMenu: () => {},
        addSplitButton: (name) => console.warn(`DocEditor (tinymce): addSplitButton "${name}" belum didukung`),
      },
    },
    // ===== setelah init =====
    getContent: (args = {}) => (args.format === 'text' ? need().editor.getText({ blockSeparator: '\n' }) : need().getHTML()),
    setContent(html) {
      need().editor.commands.setContent(html ?? '', { emitUpdate: true })
      fire('SetContent', { content: html })
      return html
    },
    insertContent: (html) => need().editor.chain().focus().insertContent(html).run(),
    resetContent(html) {
      ed.setContent(html ?? ed.startContent ?? '')
      dirty = false
    },
    getBody: () => need().editor.view.dom,
    getContainer: () => need().editor.view.dom.closest('.de'),
    getContentAreaContainer: () => need().editor.view.dom.parentElement,
    getElement: () => el,
    getDoc: () => document,
    getWin: () => window,
    focus: () => need().editor.commands.focus(),
    hasFocus: () => need().editor.isFocused,
    // Salin isi ke <textarea> asal (doc-editor sudah melakukannya otomatis setiap perubahan).
    save() {
      const html = need().getHTML()
      if ('value' in el) el.value = html
      dirty = false
      fire('SaveContent', { content: html })
      return html
    },
    load() {
      if ('value' in el) ed.setContent(el.value)
      return ed.getContent()
    },
    isDirty: () => dirty,
    setDirty(v) {
      const was = dirty
      dirty = !!v
      if (dirty && !was) fire('dirty')
    },
    isNotDirty: false,
    mode: {
      get: () => (need().isReadOnly() ? 'readonly' : 'design'),
      set: (m) => need().setReadOnly(m === 'readonly'),
      isReadOnly: () => need().isReadOnly(),
    },
    execCommand: (cmd, ui, value) => {
      const r = runCommand(need(), cmd, value)
      fire('ExecCommand', { command: cmd, value })
      return r !== false
    },
    queryCommandState(cmd) {
      const e = need().editor
      if (MARKS[cmd]) return e.isActive(MARKS[cmd])
      if (ALIGN[cmd]) return e.isActive({ textAlign: ALIGN[cmd] })
      if (cmd === 'InsertUnorderedList') return e.isActive('bulletList')
      if (cmd === 'InsertOrderedList') return e.isActive('orderedList')
      return false
    },
    queryCommandValue(cmd) {
      const s = need().editor.getAttributes('textStyle')
      return { FontName: s.fontFamily, FontSize: s.fontSize, ForeColor: s.color, HiliteColor: s.backgroundColor, BackColor: s.backgroundColor }[cmd] ?? ''
    },
    selection: {
      getContent(args = {}) {
        const { state } = need().editor
        const { from, to } = state.selection
        if (args.format === 'text') return state.doc.textBetween(from, to, '\n')
        const div = document.createElement('div')
        div.append(DOMSerializer.fromSchema(state.schema).serializeFragment(state.selection.content().content))
        return div.innerHTML
      },
      setContent: (html) => need().editor.chain().focus().insertContent(html).run(),
      getNode() {
        const { view, state } = need().editor
        const n = view.domAtPos(state.selection.from).node
        return n.nodeType === 1 ? n : n.parentElement
      },
      isCollapsed: () => need().editor.state.selection.empty,
      collapse: (toStart) => {
        const { from, to } = need().editor.state.selection
        need().editor.commands.setTextSelection(toStart ? from : to)
      },
      select: (node) => {
        const pos = need().editor.view.posAtDOM(node, 0)
        need().editor.commands.setNodeSelection(Math.max(0, pos - 1))
      },
    },
    undoManager: {
      undo: () => need().editor.commands.undo(),
      redo: () => need().editor.commands.redo(),
      hasUndo: () => need().editor.can().undo(),
      hasRedo: () => need().editor.can().redo(),
      transact(fn) { fn(); return null },
      add: () => null,
      clear: () => {},
    },
    windowManager: {
      alert: (msg, cb) => { window.alert(msg); cb?.() },
      confirm: (msg, cb) => cb?.(window.confirm(msg)),
    },
    notificationManager: {
      open: ({ text } = {}) => { console.info(`DocEditor: ${text}`); return { close() {} } },
      close() {},
    },
    remove() {
      if (!api) return
      fire('remove')
      api.destroy()
      api = null
      manager._forget(ed)
    },
    destroy() { ed.remove() },
    // Objek doc-editor asli (getDocument, exportDocx, setPage, …) untuk fitur yang tidak ada di TinyMCE.
    get docEditor() { return api },
  }

  const bound = new Set()
  function bind(key) {
    if (bound.has(key) || !api) return
    bound.add(key)
    if (TIPTAP_EVENTS[key]) api.editor.on(TIPTAP_EVENTS[key], (p) => fire(key, { originalEvent: p?.event }))
    else if (DOM_EVENTS.has(key)) api.editor.view.dom.addEventListener(key, (ev) => fire(key, { originalEvent: ev, ...pick(ev) }))
  }
  // Salinan properti umum event DOM (keyCode, key, ctrlKey, preventDefault…) agar kode TinyMCE lama tetap jalan.
  const pick = (ev) => ({ key: ev.key, keyCode: ev.keyCode, ctrlKey: ev.ctrlKey, metaKey: ev.metaKey, shiftKey: ev.shiftKey, altKey: ev.altKey,
    clipboardData: ev.clipboardData, preventDefault: () => ev.preventDefault(), stopPropagation: () => ev.stopPropagation() })

  ed._attach = (a) => {
    api = a
    ed.startContent = a.getHTML()
    a.editor.on('update', () => ed.setDirty(true))
    a.editor.on('focus', () => { manager.activeEditor = ed })
    for (const key of handlers.keys()) bind(key)
  }
  ed._custom = custom
  ed._icons = icons
  return ed
}

/** Objek global bergaya `tinymce` (init, get, remove, triggerSave, activeEditor). */
export function makeTinymce(create) {
  const editors = []
  const manager = {
    majorVersion: '7',
    minorVersion: '0',
    editors,
    activeEditor: null,
    _forget(ed) {
      editors.splice(editors.indexOf(ed), 1)
      if (manager.activeEditor === ed) manager.activeEditor = editors.at(-1) ?? null
    },
    /** tinymce.init(config) -> Promise<editor[]> */
    async init(config = {}) {
      const targets = config.target ? [config.target] : config.selector ? [...document.querySelectorAll(config.selector)] : []
      if (!targets.length) console.warn(`DocEditor (tinymce): tidak ada elemen untuk selector "${config.selector ?? ''}"`)
      if (config.inline) console.warn('DocEditor (tinymce): mode inline belum didukung; editor dibuat dengan toolbar biasa')
      const made = []
      for (const el of targets) {
        if (editors.some((e) => e.targetElm === el)) continue
        const ed = makeEditor(manager, el, config)
        config.setup?.(ed)
        // Tombol kustom dari setup -> tombol toolbar doc-editor.
        const customNames = new Set(Object.keys(ed._custom))
        const tb = toolbarFrom({ ...config, __custom: customNames })
        if (tb.unknown?.length) console.warn(`DocEditor (tinymce): tombol toolbar belum didukung, dilewati: ${tb.unknown.join(', ')}`)
        const { options, warn } = optionsFrom(config)
        if (warn.length) console.warn(`DocEditor (tinymce): opsi belum didukung, diabaikan: ${warn.join(', ')}`)
        const lang = options.lang ?? 'id'
        const t = LOCALES[lang] ?? LOCALES.id
        const buttons = {}
        for (const [name, [labelKey, run]] of Object.entries(tb.buttons ?? {})) {
          const l = t[labelKey]
          buttons[name] = { text: typeof l === 'string' ? l : l?.label ?? name, tooltip: typeof l === 'string' ? l : l?.title, onAction: run }
        }
        for (const [name, spec] of Object.entries(ed._custom)) {
          let active = false
          buttons[name] = {
            text: spec.text ?? name,
            tooltip: spec.tooltip ?? spec.text ?? name,
            icon: ed._icons[spec.icon] ?? (spec.icon && spec.icon.trim().startsWith('<') ? spec.icon : undefined),
            onAction: () => {
              const btnApi = { isActive: () => active, setActive: (v) => { active = !!v; api.editor.view.dispatch(api.editor.state.tr) }, isEnabled: () => true, setEnabled: () => {} }
              spec.onAction?.(btnApi)
            },
            isActive: spec.toggle ? () => active : undefined,
          }
        }
        // Tombol toolbar TinyMCE "save": tanpa callback, kirim form tempat textarea berada (seperti plugin save TinyMCE).
        const form = el.closest?.('form')
        let onSave = options.onSave
        if (config.save_onsavecallback) onSave = () => config.save_onsavecallback(ed)
        else if (!onSave && form && tb.groups?.flat().includes('save')) onSave = () => { ed.save(); form.requestSubmit() }
        // Unggah gambar: images_upload_handler(blobInfo, progress) atau images_upload_url (JSON { location }).
        let imageUpload = options.imageUpload
        if (config.images_upload_handler) {
          imageUpload = async (file) => {
            const info = blobInfo(file)
            await info._ready
            return config.images_upload_handler(info, () => {})
          }
        } else if (config.images_upload_url) {
          imageUpload = async (file) => {
            const body = new FormData()
            body.append('file', file, file.name)
            const res = await fetch(config.images_upload_url, { method: 'POST', body, credentials: config.images_upload_credentials ? 'include' : 'same-origin' })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const { location } = await res.json()
            return (config.images_upload_base_path ?? '') + location
          }
        }
        const api = create(el, {
          ...options,
          onSave,
          imageUpload,
          toolbar: tb.groups ? { groups: tb.groups, buttons } : { ...(tb.native ?? {}), buttons },
        })
        if (config.width) api.editor.view.dom.closest('.de').style.width = typeof config.width === 'number' ? `${config.width}px` : config.width
        ed._attach(api)
        editors.push(ed)
        manager.activeEditor = ed
        made.push(ed)
      }
      // init: setelah CSS dokumen dari URL terpasang (seperti TinyMCE menunggu content_css)
      for (const ed of made) {
        await ed.docEditor.ready
        ed.initialized = true
        ed.fire('init')
        config.init_instance_callback?.(ed)
      }
      return made
    },
    /** get() = semua editor; get(id) = editor dengan id itu, atau null */
    get(id) {
      if (id === undefined) return [...editors]
      return typeof id === 'number' ? editors[id] ?? null : editors.find((e) => e.id === id) ?? null
    },
    remove(sel) {
      const match = sel === undefined ? [...editors]
        : typeof sel === 'object' ? [sel]
        : editors.filter((e) => e.id === sel || e.id === String(sel).replace(/^#/, '') || [...document.querySelectorAll(sel)].includes(e.targetElm))
      for (const e of match) e.remove()
    },
    triggerSave() { for (const e of editors) e.save() },
    execCommand(cmd, ui, value) { return manager.activeEditor?.execCommand(cmd, ui, value) ?? false },
    on() { console.warn('DocEditor (tinymce): tinymce.on belum didukung; pasang peristiwa per editor di setup'); },
  }
  return manager
}

// blobInfo bergaya TinyMCE untuk images_upload_handler.
function blobInfo(file) {
  let b64
  return {
    id: () => file.name,
    name: () => file.name.replace(/\.[^.]+$/, ''),
    filename: () => file.name,
    blob: () => file,
    blobUri: () => URL.createObjectURL(file),
    base64: () => b64,
    uri: () => undefined,
    // base64 dibaca sinkron di TinyMCE; di sini disiapkan sebelum handler dipanggil (lihat readBase64)
    _ready: file.arrayBuffer().then((buf) => {
      let bin = ''
      const bytes = new Uint8Array(buf)
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      b64 = btoa(bin)
    }),
  }
}
