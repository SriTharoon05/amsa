export const product = { id: 'keshya-100', name: 'Keshya Hair Oil', brand: 'AMSA Ayurvedic', size: '100 ml', price: 1290 } as const;
export const money = (amount: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
