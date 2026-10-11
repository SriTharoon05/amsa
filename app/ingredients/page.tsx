import type { Metadata } from 'next';
import IngredientsExplorer from '@/components/IngredientsExplorer';
import { ingredientCount } from '@/lib/ingredients';
export const metadata: Metadata = { title: 'The Ingredients — AMSA Ayurvedic', description: `Explore all ${ingredientCount} ingredients in AMSA Keshya Hair Oil. Discover the complete formulation in a searchable botanical directory.` };
export default function IngredientsPage() { return <IngredientsExplorer/>; }
