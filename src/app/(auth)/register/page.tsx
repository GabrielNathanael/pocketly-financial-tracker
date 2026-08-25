import { redirect } from 'next/navigation'

export default function RegisterPage() {
  // Registration is disabled for single-user application
  redirect('/login')
}
