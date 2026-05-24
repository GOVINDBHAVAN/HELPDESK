import { Outlet } from 'react-router-dom'
import { Navbar } from '../components/Navbar'

export function AppLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  )
}
