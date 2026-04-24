/**
 * layout.js — Root Layout (Server Component, required by Next.js App Router)
 * The navbar client logic lives in Headerlayout.js
 */
import './globals.css';
import Headerlayout from './Headerlayout';

export const metadata = {
    title: 'RetailTalk - An NLP for querying e-commerce product',
    description: 'An NLP for querying e-commerce product. BERT-powered intelligent product search.',
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body>
                <Headerlayout>{children}</Headerlayout>
            </body>
        </html>
    );
}
