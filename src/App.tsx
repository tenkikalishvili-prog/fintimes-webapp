import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './screens/Home'
import { Analytics } from './screens/Analytics'
import { Budget } from './screens/Budget'
import { More } from './screens/More'
import { AddTransaction } from './screens/AddTransaction'
import { EditTransaction } from './screens/EditTransaction'
import { History } from './screens/History'
import { Settings } from './screens/Settings'
import { Onboarding } from './screens/Onboarding'
import { useMe } from './lib/queries'
import { getUserName } from './lib/telegram'

export default function App() {
  const me = useMe()

  // Первый вход: пока не пройден лёгкий онбординг — показываем мастер вместо экранов.
  // Ошибку/загрузку /me не перехватываем — их обрабатывают сами экраны (Home и т.д.).
  if (me.data?.needsOnboarding) {
    const name = me.data.name?.split(' ')[0] || getUserName()
    return <Onboarding name={name} />
  }

  return (
    <Routes>
      {/* Основные экраны — под общей оболочкой с таббаром и FAB */}
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="budget" element={<Budget />} />
        <Route path="more" element={<More />} />
      </Route>
      {/* Модальные экраны без таббара */}
      <Route path="/add" element={<AddTransaction />} />
      <Route path="/history" element={<History />} />
      <Route path="/edit/:id" element={<EditTransaction />} />
      <Route path="/settings" element={<Settings />} />
    </Routes>
  )
}
