import React from 'react';
import {createRoot} from 'react-dom/client';
const App=React.lazy(()=>import('./App'));
import {AuthGate} from './AuthGate';
import './styles.css';
import {createBrowserRouter,RouterProvider} from 'react-router-dom';
const router=createBrowserRouter([{path:'*',element:<AuthGate><React.Suspense fallback={<main className="main standalone" role="status">Brains…</main>}><App/></React.Suspense></AuthGate>}]);
createRoot(document.getElementById('root')!).render(<React.StrictMode><RouterProvider router={router}/></React.StrictMode>);
