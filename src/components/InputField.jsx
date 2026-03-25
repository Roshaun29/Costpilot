export function InputField({ label, type = 'text', placeholder, value, onChange }) {
  return (
    <label className="input-group">
      <span>{label}</span>
      <input type={type} placeholder={placeholder} value={value} onChange={onChange} />
    </label>
  );
}
