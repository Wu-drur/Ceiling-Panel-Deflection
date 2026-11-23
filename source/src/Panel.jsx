import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { displacementShape, displayedDisplacement, limit, span } from './model.js'

const segments = 40
const cameraPositions = {
  iso: [1.03, 0.88, 1.44],
  top: [0, 2.03, 0.0001],
}
const lowTint = new THREE.Color('#bcd8ee')
const highTint = new THREE.Color('#2470bf')
const vertexTint = new THREE.Color()
const sharedShape = Array.from({length: (segments + 1) ** 2}, (_, index) =>
  displacementShape((index % (segments + 1)) / segments, Math.floor(index / (segments + 1)) / segments))

export function makeCameraSync() {
  let pose = {position: cameraPositions.iso, zoom: 1}
  const listeners = new Set()
  return {
    read: () => pose,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    update(next, sender) {
      pose = next
      for (const listener of listeners) if (listener !== sender) listener(pose)
    },
    preset(view) {
      this.update({position: cameraPositions[view], zoom: 1})
    },
  }
}

function woodTexture(id) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 512
  const context = canvas.getContext('2d')
  const base = id === 'bamboo' ? [205, 158, 99] : id === 'plywood' ? [218, 174, 127] : [182, 137, 97]
  const pixels = context.createImageData(512, 512)
  let seed = 345
  for (let y = 0; y < 512; y++) {
    for (let x = 0; x < 512; x++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
      const stave = Math.floor(x / 43)
      const bend = Math.sin(y / 62 + x / 160) * (id === 'bamboo' ? 0.8 : 3.8)
      const grain = 8 * Math.sin((x + bend) * 0.84) + 5 * Math.sin((x - bend) * 2.3)
      const seam = id === 'bamboo' && x % 43 < 2 ? -19 : 0
      const node = id === 'bamboo' ? -13 * Math.exp(-((y - (stave * 77 + 40) % 512) ** 2) / 25) : 0
      const shade = grain + seam + node + (seed / 2 ** 32 - 0.5) * 10 + 9 * Math.sin(x / 13)
      const index = (y * 512 + x) * 4
      base.forEach((channel, i) => { pixels.data[index + i] = channel + shade })
      pixels.data[index + 3] = 255
    }
  }
  context.putImageData(pixels, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  return texture
}

function makePanel(material) {
  const group = new THREE.Group()
  const thickness = material.thickness / span
  const texture = woodTexture(material.id)
  const geometry = new THREE.PlaneGeometry(1, 1, segments, segments)
  geometry.rotateX(-Math.PI / 2)
  const position = geometry.attributes.position
  const colors = new THREE.BufferAttribute(new Float32Array(position.count * 4), 4)
  geometry.setAttribute('color', colors)
  const surface = new THREE.MeshStandardMaterial({map: texture, vertexColors: true, side: THREE.DoubleSide})
  surface.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      'diffuseColor.rgb = mix(diffuseColor.rgb, vColor.rgb, vColor.a);',
    )
  }
  group.add(new THREE.Mesh(geometry, surface))
  const bottomGeometry = geometry.clone()
  bottomGeometry.deleteAttribute('color')
  const bottom = new THREE.Mesh(bottomGeometry, new THREE.MeshStandardMaterial({
    color: material.id === 'paper' ? '#9c7953' : '#c39768', side: THREE.DoubleSide,
  }))
  group.add(bottom)
  const layers = material.id === 'plywood'
    ? ['#b58654', '#edca97', '#9d7047', '#e0b582', '#865c3d', '#e7be89']
    : material.id === 'paper' ? ['#b8885b', '#9d7752', '#d1a477'] : ['#a47340', '#d9af75']
  layers.forEach((color, index) => {
    const height = thickness / layers.length
    const side = new THREE.Mesh(new THREE.BoxGeometry(1, height, 1), [
      ...Array.from({length: 2}, () => new THREE.MeshStandardMaterial({color})),
      new THREE.MeshBasicMaterial({visible: false}), new THREE.MeshBasicMaterial({visible: false}),
      ...Array.from({length: 2}, () => new THREE.MeshStandardMaterial({color})),
    ])
    side.position.y = (index + 0.5) * height - thickness
    group.add(side)
  })
  return {
    group,
    update(maximum, scale) {
      const lower = bottomGeometry.attributes.position
      for (let index = 0; index < position.count; index++) {
        const shape = sharedShape[index]
        const y = displayedDisplacement(shape, maximum, scale)
        position.setY(index, y)
        lower.setY(index, y - thickness)
        const ratio = Math.min(1, shape * maximum / limit)
        vertexTint.copy(lowTint).lerp(highTint, ratio)
        colors.setXYZW(index, vertexTint.r, vertexTint.g, vertexTint.b, ratio * 0.86)
      }
      position.needsUpdate = lower.needsUpdate = colors.needsUpdate = true
      geometry.computeVertexNormals()
      bottomGeometry.computeVertexNormals()
    },
  }
}

function makeSupports(thickness) {
  const group = new THREE.Group()
  const metal = new THREE.MeshStandardMaterial({ color: '#a1b5c7', roughness: 0.65, metalness: 0.23 })
  for (let edge = 0; edge < 4; edge++) {
    const rail = new THREE.Group()
    const flange = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.004, 0.04), metal)
    flange.position.y = -thickness - 0.002
    const web = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.032, 0.005), metal)
    web.position.set(0, -thickness + 0.014, 0.008)
    rail.add(flange, web)
    rail.rotation.y = edge * Math.PI / 2
    rail.position.set(Math.sin(rail.rotation.y) * 0.514, 0, Math.cos(rail.rotation.y) * 0.514)
    group.add(rail)
  }
  return group
}

function makeCentreReference() {
  const group = new THREE.Group()
  const geometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, -1, 0),
  ])
  const guide = new THREE.Line(geometry, new THREE.LineDashedMaterial({
    color: '#123f70', dashSize: 0.012, gapSize: 0.008,
  }))
  const point = new THREE.Mesh(new THREE.SphereGeometry(0.013, 16, 12),
    new THREE.MeshBasicMaterial({color: '#103b68'}))
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.017, 0.0027, 8, 24),
    new THREE.MeshBasicMaterial({color: '#103b68'}))
  ring.rotation.x = -Math.PI / 2
  group.add(guide, point, ring)
  return {
    group,
    update(maximum, scale) {
      const y = displayedDisplacement(1, maximum, scale)
      group.visible = y < -0.025
      if (!group.visible) return
      geometry.attributes.position.setY(1, y)
      geometry.attributes.position.needsUpdate = true
      guide.computeLineDistances()
      point.position.y = y + 0.006
    },
  }
}

function makeArrows() {
  const group = new THREE.Group()
  const ink = new THREE.MeshBasicMaterial({ color: '#165fa4', transparent: true, depthWrite: false })
  const stem = new THREE.CylinderGeometry(0.004, 0.004, 1, 8)
  const tip = new THREE.ConeGeometry(0.013, 0.033, 12)
  const arrows = []
  for (const x of [-0.32, -0.16, 0, 0.16, 0.32]) {
    for (const z of [-0.32, -0.16, 0, 0.16, 0.32]) {
      const arrow = new THREE.Group()
      const shaft = new THREE.Mesh(stem, ink)
      const head = new THREE.Mesh(tip, ink)
      head.rotation.x = Math.PI
      head.position.y = 0.0165
      arrow.add(shaft, head)
      arrow.position.set(x, 0, z)
      group.add(arrow)
      arrows.push({arrow, shaft, shape: displacementShape(x + 0.5, z + 0.5)})
    }
  }
  return {
    group,
    update(pressure, maximum, scale) {
      group.visible = pressure > 0
      ink.opacity = Math.min(0.96, pressure / 0.15)
      const stemLength = 0.052 + pressure * 0.31
      for (const {arrow, shaft, shape} of arrows) {
        arrow.position.y = displayedDisplacement(shape, maximum, scale) + 0.029
        shaft.scale.y = stemLength
        shaft.position.y = 0.033 + stemLength / 2
      }
    },
  }
}

export default function Panel({ material, maximum, pressure, scale, showSupports, sync }) {
  const host = useRef(null)
  const sceneUpdate = useRef(null)
  const values = useRef(null)
  values.current = {maximum, pressure, scale, showSupports}
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const container = host.current
    let renderer
    try {
      renderer = new THREE.WebGLRenderer({antialias: true, alpha: true})
    } catch {
      setUnavailable(true)
      return
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75))
    renderer.domElement.setAttribute('aria-label', 'Interactive three-dimensional ceiling panel')
    container.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.05, 12)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enablePan = false
    controls.minZoom = 0.65
    controls.maxZoom = 2.5
    controls.target.set(0, 0, 0)
    let receiving = false
    const render = () => renderer.render(scene, camera)
    function receive(pose) {
      receiving = true
      camera.position.fromArray(pose.position)
      camera.zoom = pose.zoom
      camera.updateProjectionMatrix()
      controls.update()
      receiving = false
      render()
    }
    const unsubscribe = sync.subscribe(receive)
    controls.addEventListener('change', () => {
      if (!receiving) sync.update({position: camera.position.toArray(), zoom: camera.zoom}, receive)
      render()
    })

    scene.add(new THREE.HemisphereLight('#ffffff', '#98adc2', 1.85))
    const key = new THREE.DirectionalLight('#fff3e2', 2)
    key.position.set(-3, 5, 2)
    scene.add(key)
    const grid = new THREE.GridHelper(1.7, 16, '#b9ccdf', '#c4d6e6')
    grid.position.y = -0.64
    grid.material.transparent = true
    grid.material.opacity = 0.38
    scene.add(grid)
    const panel = makePanel(material)
    const supports = makeSupports(material.thickness / span)
    const arrows = makeArrows()
    const reference = makeCentreReference()
    scene.add(panel.group, supports, arrows.group, reference.group)

    function resize() {
      const {clientWidth: width, clientHeight: height} = container
      if (!width || !height) return
      const aspect = width / height
      const halfHeight = Math.max(0.60, 0.74 / aspect)
      camera.left = -halfHeight * aspect
      camera.right = halfHeight * aspect
      camera.top = halfHeight
      camera.bottom = -halfHeight
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
      render()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    sceneUpdate.current = next => {
      panel.update(next.maximum, next.scale)
      arrows.update(next.pressure, next.maximum, next.scale)
      reference.update(next.maximum, next.scale)
      supports.visible = next.showSupports
      render()
    }
    receive(sync.read())
    sceneUpdate.current(values.current)
    resize()

    return () => {
      observer.disconnect()
      unsubscribe()
      controls.dispose()
      const resources = new Set()
      scene.traverse(object => {
        if (object.geometry) resources.add(object.geometry)
        for (const entry of [object.material].flat().filter(Boolean)) {
          if (entry.map) resources.add(entry.map)
          resources.add(entry)
        }
      })
      for (const resource of resources) resource.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
      sceneUpdate.current = null
    }
  }, [material, sync])

  useEffect(() => {
    sceneUpdate.current?.({maximum, pressure, scale, showSupports})
  }, [maximum, pressure, scale, showSupports])

  return <div className="viewport" ref={host}>
    {unavailable && <p className="webgl-message">WebGL is unavailable. The calculated results are shown below.</p>}
  </div>
}
