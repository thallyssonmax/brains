import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import {AuthGate} from './AuthGate';
import './styles.css';
import {createBrowserRouter,RouterProvider} from 'react-router-dom';
const router=createBrowserRouter([{path:'*',element:<AuthGate><App/></AuthGate>}]);
createRoot(document.getElementById('root')!).render(<React.StrictMode><RouterProvider router={router}/></React.StrictMode>);
