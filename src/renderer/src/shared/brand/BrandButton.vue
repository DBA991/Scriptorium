<script setup>
function handleClick() {
  window.electronAPI.openDelta2Studio()
}
</script>

<template>
  <button
    class="brand-button"
    type="button"
    title="Delta2Studio"
    aria-label="Delta2Studio"
    @click="handleClick"
  >
    <svg
      class="brand-button-icon"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="43.90 314.88 366.76 323.29"
    >
      <g transform="translate(0,1024) scale(0.1,-0.1)" fill="#ffffff" stroke="none">
        <path
          d="M2253 6813 c-18 -25 -197 -329 -453 -768 -108 -186 -921 -1569 -1034
-1759 -44 -75 -76 -138 -74 -150 l3 -21 1570 -3 c1462 -2 1571 -1 1582 15 11
14 9 24 -11 57 -495 862 -1294 2245 -1452 2516 -44 74 -86 136 -95 138 -10 2
-26 -9 -36 -25z m127 -853 c83 -16 155 -54 221 -116 168 -161 196 -385 74
-589 -37 -60 -96 -135 -373 -470 l-149 -180 362 -3 363 -2 67 -116 c39 -69 63
-120 58 -125 -5 -5 -295 -8 -683 -7 -591 3 -675 5 -678 18 -3 16 49 81 463
580 311 375 316 382 349 444 55 103 22 222 -77 280 -117 69 -253 -2 -291 -152
l-12 -47 -127 -3 c-107 -2 -128 0 -133 13 -12 29 19 149 57 225 98 195 293
291 509 250z"
        />
      </g>
    </svg>
  </button>
</template>

<style scoped>
.brand-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  padding: 0.4rem;
  background: #252526;
  border: 1px solid #3c3c3c;
  border-radius: 6px;
  cursor: pointer;
  transition:
    border-color 0.15s,
    background 0.15s,
    transform 0.15s;
}
.brand-button:hover {
  border-color: #555;
  background: #2d2d2d;
  transform: translateY(1px);
}
.brand-button:active {
  transform: translateY(0);
}

.brand-button-icon {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
