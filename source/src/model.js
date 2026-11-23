export const span = 600
export const limit = 1.2
export const defaultPressure = 0.15
export const poisson = 0.30
export const coefficient = 0.00406

export const materials = [
  { id: 'bamboo', name: 'Engineered Bamboo + TIFC', modulus: 17, thickness: 6 },
  { id: 'plywood', name: 'Plywood + Natural Wood Veneer', modulus: 6, thickness: 6 },
  { id: 'paper', name: 'Paper/Cardboard + Natural Wood Veneer', modulus: 2.7, thickness: 7 },
]

export function rigidity({ modulus, thickness }) {
  return (modulus * 1e9) * (thickness / 1000) ** 3 / (12 * (1 - poisson ** 2))
}

export function deflection(material, pressure) {
  return coefficient * (pressure * 1000) * (span / 1000) ** 4 / rigidity(material) * 1000
}

const oddIndices = Array.from({ length: 16 }, (_, i) => 2 * i + 1)
const terms = oddIndices.flatMap(m => oddIndices.map(n => [m, n, 1 / (m * n * (m * m + n * n) ** 2)]))

function navierSum(x, z) {
  return terms.reduce((sum, [m, n, weight]) =>
    sum + weight * Math.sin(m * Math.PI * x) * Math.sin(n * Math.PI * z), 0)
}

const centre = navierSum(0.5, 0.5)

// Normalize the Navier shape to the specified rounded centre coefficient.
export function displacementShape(x, z) {
  if (x === 0 || x === 1 || z === 0 || z === 1) return 0
  return navierSum(x, z) / centre
}

export function displayedDisplacement(shape, maximumMm, scale) {
  return -shape * maximumMm * scale / span
}
