import type { Metadata } from 'next';
import { MyProductsClient } from './MyProductsClient';

export const metadata: Metadata = {
  title: 'Meine Produkte',
  robots: { index: false },
};

export default function MyProductsPage() {
  return <MyProductsClient />;
}
