import assert from 'node:assert/strict'
import test from 'node:test'
import { coefficient, deflection, displayedDisplacement, displacementShape, limit, materials, rigidity } from './src/model.js'

test('default deflections, zero load, linear response, and 1.2 mm limit', () => {
  const expected = ['0.235', '0.665', '0.931']
  materials.forEach((material, index) => {
    const baseline = deflection(material, 0.15)
    assert.equal(baseline.toFixed(3), expected[index])
    assert.equal(deflection(material, 0), 0)
    assert.equal(deflection(material, 0.30), 2 * baseline)
    assert.ok(baseline <= limit)
    assert.equal(deflection(material, 0.30) <= limit, index === 0)
  })
  assert.ok(Math.abs(rigidity(materials[0]) - 336.263736) < 1e-6)
})

test('Navier field is zero on all edges, symmetric, and peaks at the centre', () => {
  for (let i = 0; i <= 40; i++) {
    const x = i / 40
    for (const [u, v] of [[0, x], [1, x], [x, 0], [x, 1]]) assert.equal(displacementShape(u, v), 0)
    for (let j = 0; j <= 40; j++) {
      const z = j / 40
      const value = displacementShape(x, z)
      assert.ok(value >= 0 && value <= 1)
      assert.ok(Math.abs(value - displacementShape(1 - x, z)) < 1e-12)
      assert.ok(Math.abs(value - displacementShape(z, x)) < 1e-12)
    }
  }
  assert.equal(displacementShape(0.5, 0.5), 1)
  assert.equal(displayedDisplacement(1, 0.9, 200), -0.3)
  let raw = 0
  for (let m = 1; m <= 101; m += 2) {
    for (let n = 1; n <= 101; n += 2) {
      raw += Math.sin(m * Math.PI / 4) * Math.sin(n * Math.PI / 4) / (m * n * (m ** 2 + n ** 2) ** 2)
    }
  }
  assert.ok(Math.abs(coefficient * displacementShape(0.25, 0.25) - 16 * raw / Math.PI ** 6) < 2e-6)
})
