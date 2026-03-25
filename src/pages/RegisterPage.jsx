import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { InputField } from '../components/InputField';
import { AuthLayout } from '../layout/AuthLayout';
import { register } from '../services/api';

export function RegisterPage({ onAuth }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: 'Alex Morgan', email: 'alex@costcommand.ai', password: 'password123' });
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    const response = await register(form);
    onAuth(response.user);
    setLoading(false);
    navigate('/dashboard');
  };

  return (
    <AuthLayout
      title="Create account"
      subtitle="Launch a new FinOps workspace"
      footerText="Already have access?"
      footerLinkLabel="Sign in"
      footerLinkTo="/"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <InputField label="Full name" placeholder="Alex Morgan" value={form.name} onChange={handleChange('name')} />
        <InputField label="Email" type="email" placeholder="you@company.com" value={form.email} onChange={handleChange('email')} />
        <InputField label="Password" type="password" placeholder="Create a secure password" value={form.password} onChange={handleChange('password')} />
        <div className="auth-actions auth-actions-stack">
          <p className="helper-copy">By continuing, you agree to secure anomaly monitoring and cloud sync policies.</p>
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Creating workspace...' : 'Create workspace'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
