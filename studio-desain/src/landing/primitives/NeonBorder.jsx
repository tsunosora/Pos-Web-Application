export default function NeonBorder({ as: Tag = 'div', className = '', children, ...rest }) {
  return (
    <Tag className={`neon-border ${className}`} {...rest}>
      {children}
    </Tag>
  );
}
