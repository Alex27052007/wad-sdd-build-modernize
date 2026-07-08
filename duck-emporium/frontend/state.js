export function createInitialState() {
  return {
    ducks: [],
    filteredDucks: [],
    duckOfTheDay: null,
    selectedDuckId: null,
    selectedDuck: null,
    cart: [],
    cartOpen: false,
    checkoutOpen: false,
    activeView: "shop",
    filters: {
      query: "",
      category: "",
      minPrice: "",
      maxPrice: "",
    },
    checkout: {
      name: "",
      email: "",
      address: "",
      card: "",
      errors: {},
    },
    quiz: {
      answers: {},
      result: null,
    },
    errors: {},
  };
}

let currentState = createInitialState();

function clone(value) {
  return structuredClone(value);
}

export function setState(patch) {
  const base = clone(currentState);
  const next = {
    ...base,
    ...clone(patch),
  };
  currentState = next;
  return clone(currentState);
}

export function getState() {
  return clone(currentState);
}
