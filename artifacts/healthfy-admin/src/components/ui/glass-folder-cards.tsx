import * as React from "react"
import { ArtCanvas, fanSlot, hashString, rng, type ArtPreset, type ArtRecipe } from "./glass-folder-art"
import "./glass-folder.css"

/**
 * Glass Folder Cards — adapted for Healthfy client portfolio.
 * Back panel holds generated artwork, the sheets are REAL records (projects,
 * invoices, actions) and the frosted front panel carries the client's logo and
 * name. Hover/focus leans the glass; tap, Enter or Space opens it.
 */

export type { ArtPreset, ArtRecipe }
export type FolderArt = ArtPreset | ArtRecipe | "none"

export type FolderFile = {
  key: string
  name: string
  meta?: string
  /** Large value in the body of the sheet (e.g. a total). */
  big?: string
  detail?: string
  kind?: "doc" | "action"
  onSelect?: () => void
  testId?: string
}

export type FolderMenuItem = { label: string; onSelect?: () => void; danger?: boolean; testId?: string }

export type GlassFolderProps = {
  label: string
  meta?: string
  logoUrl?: string
  fallback?: string
  status?: { value: string; label: string }
  tone?: "light" | "dark"
  art?: FolderArt
  seed?: number
  files: FolderFile[]
  menu?: FolderMenuItem[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
  width?: number
  appearDelay?: number
  testId?: string
}

const W = 340
const H = 272
const HEADROOM = 54
const FRONT_TOP = 74
const FRONT_H = H - FRONT_TOP

const BACK_PATH =
  "M0 56A22 22 0 0 1 22 34L146 34C170 34 172 0 198 0L318 0A22 22 0 0 1 340 22L340 250A22 22 0 0 1 318 272L22 272A22 22 0 0 1 0 250Z"
const FRONT_PATH =
  "M0 22A22 22 0 0 1 22 0L118 0C144 0 146 32 172 32L318 32A22 22 0 0 1 340 54L340 " +
  (FRONT_H - 22) + "A22 22 0 0 1 318 " + FRONT_H + "L22 " + FRONT_H + "A22 22 0 0 1 0 " + (FRONT_H - 22) + "Z"

const MAX_VISIBLE = 4

function Logo({ url, fallback, label }: { url?: string; fallback: string; label: string }) {
  const [broken, setBroken] = React.useState(false)
  React.useEffect(() => setBroken(false), [url])
  return (
    <span className="gf-logo">
      {url && !broken ? (
        <img src={url} alt={"Logo " + label} draggable={false} onError={() => setBroken(true)} />
      ) : (
        <span className="gf-logo-initials" aria-hidden="true">{fallback}</span>
      )}
    </span>
  )
}

export default function GlassFolder({
  label, meta, logoUrl, fallback = "", status, tone = "light", art = "aurora", seed = 3,
  files, menu = [], open: openProp, onOpenChange, width = 340, appearDelay = 0, testId,
}: GlassFolderProps) {
  const uid = React.useId().replace(/:/g, "")
  const rootRef = React.useRef<HTMLDivElement>(null)
  const filesRef = React.useRef<HTMLDivElement>(null)
  const hitRef = React.useRef<HTMLButtonElement>(null)
  const keyRef = React.useRef<HTMLButtonElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const [openState, setOpenState] = React.useState(false)
  const open = openProp ?? openState
  const onOpenRef = React.useRef(onOpenChange)
  onOpenRef.current = onOpenChange
  const setOpen = React.useCallback((next: boolean) => {
    if (openProp === undefined) setOpenState(next)
    onOpenRef.current?.(next)
  }, [openProp])
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [entered, setEntered] = React.useState(false)

  const k = width / W
  const density = Math.min(1.5, Math.max(1, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1)) * k

  React.useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === "undefined") { setEntered(true); return }
    let t = 0
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return
      io.disconnect()
      t = window.setTimeout(() => setEntered(true), appearDelay)
    }, { threshold: 0.15 })
    io.observe(el)
    return () => { io.disconnect(); window.clearTimeout(t) }
  }, [appearDelay])

  React.useEffect(() => {
    const el = rootRef.current
    if (!el) return
    let raf = 0, px = 0, py = 0
    const write = () => { raf = 0; el.style.setProperty("--gf-px", px.toFixed(3)); el.style.setProperty("--gf-py", py.toFixed(3)) }
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return
      const r = el.getBoundingClientRect()
      px = ((e.clientX - r.left) / r.width) * 2 - 1
      py = ((e.clientY - r.top) / r.height) * 2 - 1
      if (!raf) raf = requestAnimationFrame(write)
    }
    const leave = () => { px = 0; py = 0; if (!raf) raf = requestAnimationFrame(write) }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerleave", leave)
    return () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerleave", leave); cancelAnimationFrame(raf) }
  }, [])

  React.useEffect(() => { filesRef.current?.toggleAttribute("inert", !open) }, [open])

  React.useEffect(() => {
    if (!open && !menuOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      if (menuOpen) { setMenuOpen(false); keyRef.current?.focus() }
      else { setOpen(false); hitRef.current?.focus() }
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (menuOpen && !menuRef.current?.contains(t) && !keyRef.current?.contains(t)) setMenuOpen(false)
      if (open && !menuOpen && !rootRef.current?.contains(t)) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown) }
  }, [open, menuOpen, setOpen])

  React.useEffect(() => {
    if (menuOpen) menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus()
  }, [menuOpen])

  const menuItems: FolderMenuItem[] = [{ label: open ? "Fechar pasta" : "Abrir pasta", onSelect: () => setOpen(!open) }, ...menu]

  const onMenuKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])
    const at = items.indexOf(document.activeElement as HTMLElement)
    const go = (i: number) => { e.preventDefault(); items[(i + items.length) % items.length]?.focus() }
    if (e.key === "ArrowDown") go(at + 1)
    else if (e.key === "ArrowUp") go(at - 1)
    else if (e.key === "Home") go(0)
    else if (e.key === "End") go(items.length - 1)
    else if (e.key === "Tab") setMenuOpen(false)
  }

  const start = Math.max(0, files.length - MAX_VISIBLE)
  const visible = files.slice(start)

  return (
    <div
      ref={rootRef}
      className="gf-root"
      data-tone={tone}
      data-open={open || undefined}
      data-entered={entered || undefined}
      style={{ width, height: (H + HEADROOM) * k }}
      data-testid={testId}
    >
      <div className="gf-stage" style={{ transform: "translateY(" + HEADROOM * k + "px) scale(" + k + ")" }}>
        <div className="gf-tilt">
          <div className="gf-shadow" aria-hidden="true" />
          <div className="gf-back" style={{ clipPath: "path('" + BACK_PATH + "')" }} aria-hidden="true">
            {art !== "none" ? <ArtCanvas className="gf-art" art={art} seed={seed} w={W + 24} h={H + 24} density={density} priority={0} /> : null}
            <div className="gf-back-sheen" />
          </div>
          <svg className="gf-rim gf-back-rim" viewBox={"0 0 " + W + " " + H} aria-hidden="true"><path d={BACK_PATH} /></svg>

          <div className="gf-front" style={{ clipPath: "path('" + FRONT_PATH + "')" }}>
            <div className="gf-tint" aria-hidden="true" />
            <div className="gf-spec" aria-hidden="true" />
            <svg className="gf-rim gf-front-rim" viewBox={"0 0 " + W + " " + FRONT_H} aria-hidden="true">
              <defs>
                <linearGradient id={"gf-rim-" + uid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#fff" stopOpacity="0.95" />
                  <stop offset="0.35" stopColor="#fff" stopOpacity="0.35" />
                  <stop offset="1" stopColor="#fff" stopOpacity="0.12" />
                </linearGradient>
              </defs>
              <path d={FRONT_PATH} stroke={"url(#gf-rim-" + uid + ")"} />
            </svg>
            <button
              ref={hitRef}
              type="button"
              className="gf-hit"
              aria-expanded={open}
              aria-label={(open ? "Fechar pasta de " : "Abrir pasta de ") + label}
              onClick={() => { setMenuOpen(false); setOpen(!open) }}
              data-testid={testId ? testId + "-toggle" : undefined}
            />
            {status ? <span className="gf-status" data-s={status.value}>{status.label}</span> : null}
            <div className="gf-brand">
              <Logo url={logoUrl} fallback={fallback} label={label} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span className="gf-title">{label}</span>
                {meta ? <span className="gf-meta" key={meta}>{meta}</span> : null}
              </div>
            </div>
          </div>

          <div ref={filesRef} className="gf-files" role="list" aria-label={"Conteúdo de " + label}>
            {visible.map((file, v) => {
              const slot = fanSlot(v, visible.length)
              const jitter = rng(hashString(file.key))
              return (
                <div key={file.key} role="listitem" className="gf-sheet-slot">
                  <button
                    type="button"
                    className={"gf-sheet" + (file.kind === "action" ? " gf-sheet--action" : "")}
                    style={{
                      "--gf-slot": slot,
                      "--gf-depth": visible.length - 1 - v,
                      "--gf-jx": ((jitter() - 0.5) * 10).toFixed(2) + "px",
                      "--gf-jr": ((jitter() - 0.5) * 3.2).toFixed(2) + "deg",
                      zIndex: v + 1,
                    } as React.CSSProperties}
                    onClick={() => file.onSelect?.()}
                    data-testid={file.testId}
                  >
                    <span className="gf-sheet-head">
                      <span className="gf-sheet-name">{file.name}</span>
                      {file.meta ? <span className="gf-sheet-meta">{file.meta}</span> : null}
                    </span>
                    {file.big || file.detail ? (
                      <span className="gf-sheet-body">
                        {file.big ? <span className="gf-sheet-big">{file.big}</span> : null}
                        {file.detail ? <span>{file.detail}</span> : null}
                      </span>
                    ) : (
                      <span className="gf-lines" aria-hidden="true"><i style={{ width: "86%" }} /><i style={{ width: "64%" }} /><i style={{ width: "42%" }} /></span>
                    )}
                  </button>
                </div>
              )
            })}
          </div>

          <button
            ref={keyRef}
            type="button"
            className="gf-key gf-key--more"
            aria-label={"Mais opções para " + label}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-controls={"gf-menu-" + uid}
            onClick={() => setMenuOpen((m) => !m)}
            data-testid={testId ? testId + "-menu" : undefined}
          >
            <svg className="gf-glyph gf-glyph--more" viewBox="0 0 30 12" aria-hidden="true">
              <rect x="1" y="1.5" width="8" height="9" rx="3.4" />
              <rect x="11" y="1.5" width="8" height="9" rx="3.4" />
              <rect x="21" y="1.5" width="8" height="9" rx="3.4" />
            </svg>
          </button>

          <div ref={menuRef} id={"gf-menu-" + uid} role="menu" aria-label={"Opções de " + label} className="gf-menu" data-open={menuOpen || undefined} onKeyDown={onMenuKey}>
            {menuItems.map((item, i) => (
              <button
                key={item.label + i}
                type="button"
                role="menuitem"
                tabIndex={menuOpen ? -1 : undefined}
                disabled={!menuOpen}
                className={"gf-menu-item" + (item.danger ? " gf-menu-item--danger" : "")}
                onClick={() => { setMenuOpen(false); keyRef.current?.focus(); item.onSelect?.() }}
                data-testid={item.testId}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Measures its cell and renders a folder that fills it. */
export function FluidGlassFolder(props: Omit<GlassFolderProps, "width">) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [w, setW] = React.useState(0)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return <div ref={ref} style={{ width: "100%" }}>{w > 0 ? <GlassFolder {...props} width={Math.min(w, 420)} /> : <div style={{ aspectRatio: "340 / 326" }} />}</div>
}
