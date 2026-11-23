import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Panel, { makeCameraSync } from './Panel.jsx'
import { defaultPressure, deflection, limit, materials } from './model.js'
import './styles.css'

const sourceUrl = import.meta.env.VITE_SOURCE_URL
const format = (value, places) => value.toFixed(places)
const initialFrame = { mode: 'idle', pressure: 0 }

function App() {
  const [pressure, setPressure] = useState(defaultPressure)
  const [applied, setApplied] = useState(0)
  const [mode, setMode] = useState('idle')
  const [scale, setScale] = useState(200)
  const [view, setView] = useState('iso')
  const [supports, setSupports] = useState(true)
  const [comparison, setComparison] = useState('all')
  const sync = useMemo(makeCameraSync, [])
  const frame = useRef({...initialFrame})
  const pausedMode = useRef('apply')

  useEffect(() => {
    if (mode === 'idle' || mode === 'paused') return
    let handle
    const startPressure = frame.current.pressure
    const target = mode === 'remove' ? 0 : pressure
    const duration = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 950
    const start = performance.now()
    const tick = now => {
      const elapsed = Math.min(1, (now - start) / duration)
      const fraction = duration ? elapsed ** 2 * (3 - 2 * elapsed) : 1
      const next = startPressure + (target - startPressure) * fraction
      frame.current = {mode, pressure: next}
      setApplied(next)
      if (fraction < 1 && startPressure !== target) handle = requestAnimationFrame(tick)
      else {
        frame.current.mode = 'idle'
        setMode('idle')
      }
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [mode, pressure])

  function changePressure(next) {
    setPressure(next)
    if (mode === 'idle' && frame.current.pressure > 0) setMode('apply')
  }

  function changeView(next) {
    setView(next)
    sync.preset(next)
  }

  function reset() {
    frame.current = {...initialFrame}
    setApplied(0)
    setMode('idle')
    setPressure(defaultPressure)
    setScale(200)
    setSupports(true)
    setComparison('all')
    changeView('iso')
  }

  function togglePlayback() {
    if (mode === 'apply' || mode === 'remove') {
      pausedMode.current = mode
      setMode('paused')
    } else if (mode === 'paused') {
      setMode(pausedMode.current)
    } else {
      frame.current.pressure = 0
      setApplied(0)
      setMode('apply')
    }
  }

  const running = mode === 'apply' || mode === 'remove'
  const shownMaterials = comparison === 'all' ? materials : materials.filter(material => material.id === comparison)

  return <main>
    <header className="hero">
      <p className="eyebrow">Imperial College London <span>·</span> Materials Selection</p>
      <h1>Interactive Deflection Comparison of Ceiling Panel Materials</h1>
      <p className="specs">600 × 600 mm <span>·</span> Four-edge simple supports</p>
    </header>

    <section className="controls" aria-label="Simulation controls">
      <div className="control">
        <label htmlFor="pressure">Load pressure <output htmlFor="pressure">{format(pressure, 2)} kPa</output></label>
        <input id="pressure" type="range" min="0" max="0.30" step="0.01" value={pressure}
          onChange={event => changePressure(Number(event.target.value))}/>
        <div className="range-labels"><span>0.00</span><span>0.30 kPa</span></div>
      </div>
      <div className="control">
        <span className="control-label">Animation</span>
        <div className="buttons">
          <button className="primary" onClick={() => setMode('apply')}>Apply Load</button>
          <button onClick={() => setMode('remove')}>Remove Load</button>
          <button onClick={togglePlayback}>{running ? 'Pause' : 'Play'}</button>
          <button onClick={reset}>Reset</button>
        </div>
      </div>
      <div className="control">
        <span className="control-label" id="scale-label">Deformation scale</span>
        <div className="buttons segmented" role="group" aria-labelledby="scale-label">
          {[1, 100, 200].map(value => <button key={value} aria-pressed={scale === value}
            onClick={() => setScale(value)}>{value === 1 ? 'Actual' : '×' + value}</button>)}
        </div>
      </div>
      <div className="control">
        <span className="control-label" id="view-label">View</span>
        <div className="buttons segmented" role="group" aria-labelledby="view-label">
          <button aria-pressed={view === 'iso'} onClick={() => changeView('iso')}>Isometric View</button>
          <button aria-pressed={view === 'top'} onClick={() => changeView('top')}>Top View</button>
        </div>
      </div>
    </section>

    <section aria-label="Material comparison">
      <div className="comparison-bar">
        <label className="material-picker">
          <select aria-label="Material view" value={comparison} onChange={event => setComparison(event.target.value)}>
            <option value="all">Compare All Three Materials</option>
            {materials.map(material => <option key={material.id} value={material.id}>{material.name}</option>)}
          </select>
        </label>
        <label className="support-toggle"><input type="checkbox" checked={supports}
          onChange={event => setSupports(event.target.checked)}/> Show T24 Supports</label>
        <span className="viewport-hint">Drag to rotate · Scroll to zoom all panels</span>
      </div>
      <div className={'panels ' + (comparison === 'all' ? '' : 'single')}>
        {shownMaterials.map(material => {
          const maximum = deflection(material, applied)
          const passes = maximum <= limit
          return <article key={material.id} className="panel">
            <div className="panel-heading">
              <h2>{material.name}</h2>
              <p>Young’s modulus <b>{material.modulus} GPa</b><span>·</span> Thickness <b>{material.thickness} mm</b></p>
            </div>
            <Panel material={material} maximum={maximum} pressure={applied} scale={scale} showSupports={supports} sync={sync}/>
            <div className="readout">
              <div><span>Maximum deflection</span><strong>{format(maximum, 3)} <small>mm</small></strong></div>
              <span className={'result ' + (passes ? 'pass' : 'fail')}>{passes ? 'PASS' : 'FAIL'}</span>
            </div>
            <div className="metrics"><span>Applied pressure <b>{format(applied, 3)} kPa</b></span><span>Limit <b>{format(limit, 1)} mm</b></span></div>
          </article>
        })}
      </div>
    </section>

    <div className="notes">
      <div className="legend"><strong>Downward displacement</strong><span>0 mm</span><i aria-hidden="true"></i><span>≥ 1.2 mm</span><span className="reference-key">Dashed line · Centre displacement</span></div>
      <p>Deformation is exaggerated for visualisation. Results are based on a simplified isotropic thin-plate model.</p>
    </div>
    <footer>
      <details><summary>Model and assumptions</summary>
        <p>Preliminary elastic bending under uniform transverse pressure. Four-edge simply supported square plates.
          Poisson’s ratio is 0.30. The displacement field uses the Navier double-sine series.
          Centre deflection uses δ<sub>max</sub> = 0.00406 qL⁴/D and D = Et³/[12(1 − ν²)].
          Material properties are preliminary coursework estimates.</p>
      </details>
      {sourceUrl ? <a href={sourceUrl}>View Source Code</a> : <a href="./source.zip" download>View Source Code</a>}
    </footer>
  </main>
}

createRoot(document.getElementById('root')).render(<App />)
