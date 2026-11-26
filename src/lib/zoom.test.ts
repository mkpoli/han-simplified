import { describe, expect, test } from 'bun:test'
import { aroundPoint, clampZoom, confinePan, ZOOM_MAX } from './zoom'

describe('zoom helpers', () => {
  test('clampZoom bounds scale between 1 and ZOOM_MAX', () => {
    expect(clampZoom(0.2)).toBe(1)
    expect(clampZoom(2.5)).toBe(2.5)
    expect(clampZoom(99)).toBe(ZOOM_MAX)
  })

  test('confinePan clamps pan to picture overflow', () => {
    const pic = { width: 400, height: 600 }
    const frame = { width: 400, height: 600 }
    expect(confinePan({ x: 50, y: -50 }, 1, pic, frame)).toEqual({ x: 0, y: 0 })
    expect(confinePan({ x: 500, y: -500 }, 2, pic, frame)).toEqual({ x: 200, y: -300 })
  })

  test('aroundPoint keeps cursor point stationary across zoom', () => {
    expect(aroundPoint({ x: 0, y: 0 }, { x: 100, y: -50 }, 1, 2)).toEqual({ x: -100, y: 50 })
  })
})
