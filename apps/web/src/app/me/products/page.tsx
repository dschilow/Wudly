import type { Metadata } from 'next';
import { MyProductsClient } from './MyProductsClient';

export const metadata: Metadata = {
  title: 'Besitzen',
  robots: { index: false },
};

export default function MyProductsPage() {
  return <MyProductsClient />;
}
