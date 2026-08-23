import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './screens/Home'
import { Analytics } from './screens/Analytics'
import { Budget } from './screens/Budget'
import { More } from './screens/More'
import { AddTransaction } from './screens/AddTransaction'

export default function App() {
  return (
    <Routes>
      {/* Основные экраны — под общей оболочкой с таббаром и FAB */}
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="budget" element={<Budget />} />
        <Route path="more" element={<More />} />
      </Route>
      {/* Модальный экран без таббара */}
      <Route path="/add" element={<AddTransaction />} />
    </Routes>
  )
}
