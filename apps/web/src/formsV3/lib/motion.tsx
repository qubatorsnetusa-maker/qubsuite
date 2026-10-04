import React, { forwardRef } from 'react';

type MotionProps = React.HTMLAttributes<HTMLElement> & {
  initial?: unknown;
  animate?: unknown;
  exit?: unknown;
  transition?: unknown;
  whileHover?: unknown;
  whileTap?: unknown;
  layout?: boolean | string;
  custom?: unknown;
};

const createMotionComponent = <T extends HTMLElement>(tag: string) =>
  forwardRef<T, MotionProps & React.HTMLProps<T>>(({ initial, animate, exit, transition, whileHover, whileTap, layout, custom, ...props }, ref) =>
    React.createElement(tag, { ...props, ref })
  );

export const motion = {
  div: createMotionComponent<HTMLDivElement>('div'),
  button: createMotionComponent<HTMLButtonElement>('button'),
  span: createMotionComponent<HTMLSpanElement>('span'),
  section: createMotionComponent<HTMLElement>('section'),
  form: createMotionComponent<HTMLFormElement>('form'),
  header: createMotionComponent<HTMLElement>('header'),
  footer: createMotionComponent<HTMLElement>('footer'),
  nav: createMotionComponent<HTMLElement>('nav'),
  main: createMotionComponent<HTMLElement>('main'),
  p: createMotionComponent<HTMLParagraphElement>('p'),
  h1: createMotionComponent<HTMLHeadingElement>('h1'),
  h2: createMotionComponent<HTMLHeadingElement>('h2'),
  h3: createMotionComponent<HTMLHeadingElement>('h3'),
};

export const AnimatePresence: React.FC<{
  children: React.ReactNode;
  mode?: string;
  custom?: unknown;
  initial?: boolean;
  onExitComplete?: () => void;
}> = ({ children }) => <>{children}</>;

export const useReducedMotion = () => false;
