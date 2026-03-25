import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { InputField } from '../components/InputField';
import { AuthLayout } from '../layout/AuthLayout';
import { login } from '../services/api';

export function LoginPage({ onAuth }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: 'alex@costcommand.ai', password: 'password123' });
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    const response = await login(form);
    onAuth(response.user);
    setLoading(false);
    navigate('/dashboard');
  };

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Access your spend command center"
      footerText="Need an account?"
      footerLinkLabel="Create one"
      footerLinkTo="/register"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <InputField label="Email" type="email" placeholder="you@company.com" value={form.email} onChange={handleChange('email')} />
        <InputField label="Password" type="password" placeholder="Enter your password" value={form.password} onChange={handleChange('password')} />
        <div className="auth-actions">
          <Link to="/register">Request access</Link>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
