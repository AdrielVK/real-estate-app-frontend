import { render, screen } from '@testing-library/react';

function Greeting({ name }: { name: string }) {
  return <h1>Hello, {name}!</h1>;
}

describe('smoke', () => {
  it('renders a heading with custom text', () => {
    render(<Greeting name="world" />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hello, world!');
  });

  it('loads jest-dom matchers', () => {
    render(<Greeting name="testing-library" />);
    const heading = screen.getByRole('heading');
    expect(heading).toBeInTheDocument();
  });
});
