/** UBIX API Client */
const API = {
  base: '/api',
  async get(path) {
    const res = await fetch(this.base + path);
    return res.json();
  },
  async post(path, body = {}) {
    const res = await fetch(this.base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.json();
  },
};
