import { colors } from '@/themes/color.stylex'

interface Particle {
  x: number
  y: number
  ox: number
  oy: number
  vx: number
  vy: number
}

export class EffectParticles {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  private w: number
  private h: number
  private dpr: number
  private particles: Particle[]
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true })!
    this.w = 0
    this.h = 0
    this.dpr = Math.floor(window.devicePixelRatio)
    this.particles = []
  }

  init(w: number, h: number, dpr: number = window.devicePixelRatio) {
    if (!this.canvas) {
      return
    }
    this.w = w
    this.h = h
    this.dpr = Math.floor(window.devicePixelRatio)
    this.refresh()
    writeBoundingRectForCanvas(this.canvas, w, h, dpr)
    this.ctx.scale(dpr, dpr)
    this.addMouseInteraction()
  }

  private calculateFontSize(): number {
    const baseFontSize = Math.min(this.w, this.h) * 0.3
    return Math.max(20, Math.min(80, baseFontSize))
  }

  private sample(text: string) {
    const fontSize = this.calculateFontSize()
    const spacedText = text.split('').join('\u2009')
    this.ctx.font = `${fontSize}px Arial`
    this.ctx.textAlign = 'center'
    this.ctx.textBaseline = 'middle'
    this.ctx.imageSmoothingEnabled = false
    const foreground = getCSSVariable(colors.foreground)
    if (!foreground) { throw new Error('Foreground color is not defined') }
    this.ctx.fillStyle = foreground
    this.ctx.fillText(spacedText, this.w / 2, this.h / 2)
    const bitmap = this.ctx.getImageData(0, 0, this.w * this.dpr, this.h * this.dpr)
    this.refresh()
    const particles: Particle[] = []
    const step = 2 * this.dpr

    for (let y = 0; y < this.h * this.dpr; y += step) {
      for (let x = 0; x < this.w * this.dpr; x += step) {
        const i = (y * this.w * this.dpr + x) * 4
        const a = bitmap.data[i + 3]
        if (a > 100) {
          particles.push({
            x: x / this.dpr,
            y: y / this.dpr,
            ox: x / this.dpr,
            oy: y / this.dpr,
            vx: (Math.random() - 0.5) * 1.5,
            vy: (Math.random() - 0.5) * 1.5
          })
        }
      }
    }
    return { particles, foreground }
  }

  refresh() {
    this.ctx.clearRect(0, 0, this.w, this.h)
  }

  draw(text?: string) {
    if (!text) { return }
    const { particles, foreground } = this.sample(text)
    this.refresh()
    this.particles = particles

    const flush = () => {
      this.refresh()
      for (const p of particles) {
        p.x += p.vx
        p.y += p.vy

        const dx = p.ox - p.x
        const dy = p.oy - p.y
        p.vx += dx * 0.01
        p.vy += dy * 0.01

        p.vx *= 0.95
        p.vy *= 0.95

        this.ctx.fillRect(p.x, p.y, 2, 2)
        this.ctx.fillStyle = foreground
      }
      requestAnimationFrame(() => flush())
    }

    flush()
  }

  addMouseInteraction() {
    const pointer = { x: 0, y: 0, isActive: false }

    const onPointerMove = (e: MouseEvent | Touch) => {
      const rect = this.canvas.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
      pointer.isActive = true
    }

    this.canvas.addEventListener('mousemove', (e) => onPointerMove(e))
    this.canvas.addEventListener('mouseleave', () => {
      pointer.isActive = false
    })

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault()
      onPointerMove(e.touches[0])
    })

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault()
      onPointerMove(e.touches[0])
    })

    this.canvas.addEventListener('touchend', () => {
      pointer.isActive = false
    })

    const updateParticles = () => {
      if (pointer.isActive) {
        for (const p of this.particles) {
          const dx = p.x - pointer.x
          const dy = p.y - pointer.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const radius = Math.min(100, Math.max(this.w, this.h) * 0.2)

          if (dist < radius) {
            const force = (radius - dist) / radius
            p.vx += (dx / dist) * force * 2
            p.vy += (dy / dist) * force * 2
          }
        }
      }
      requestAnimationFrame(updateParticles)
    }

    updateParticles()
  }
}

export function writeBoundingRectForCanvas(c: HTMLCanvasElement, w: number, h: number, dpr: number) {
  c.width = w * dpr
  c.height = h * dpr
  c.style.cssText = `width: ${w}px; height: ${h}px`
}

export function getCSSVariable(cssVar: string) {
  const styles = getComputedStyle(document.documentElement)
  const matched = cssVar.match(/var\((--\w+)\)/)
  if (matched && matched.length === 2) {
    const variable = matched[1]
    return styles.getPropertyValue(variable).trim()
  }
  return ''
}
