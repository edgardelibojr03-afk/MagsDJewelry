// src/components/Dashboard.jsx
import { useEffect, useState } from 'react'
import { supabase } from '../services/supabaseClient'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    const getUserAndSession = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) setError(userError.message);
        setUser(user);
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) setError(sessionError.message);
        setSession(sessionData?.session);
      } catch (err) {
        setError(err.message);
      }
    };
    getUserAndSession();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-gray-800">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      {error && <p className="text-red-500 mb-4">{error}</p>}
      {user ? (
        <>
          <div className="mb-6 w-full max-w-xl bg-white rounded shadow p-4">
            <h2 className="text-xl font-semibold mb-2">User Info</h2>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto mb-2">{JSON.stringify(user, null, 2)}</pre>
            <h2 className="text-xl font-semibold mb-2">Session</h2>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto mb-2">{JSON.stringify(session, null, 2)}</pre>
            <p className="text-green-600 font-medium">Connection to Supabase successful!</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
          >
            Logout
          </button>
        </>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  )
}