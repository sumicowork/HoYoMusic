import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  children: React.ReactNode;
}

const pageVariants = {
  initial: { opacity: 0, y: 12 },
  in: { opacity: 1, y: 0 },
  out: { opacity: 0, y: -12 },
};

const pageTransition = {
  type: 'tween' as const,
  ease: 'easeInOut' as const,
  duration: 0.2,
};

/**
 * Wraps page content with a subtle fade+slide animation.
 * Usage: <PageTransition><YourPage /></PageTransition>
 */
const PageTransition: React.FC<Props> = ({ children }) => (
  <motion.div
    initial="initial"
    animate="in"
    exit="out"
    variants={pageVariants}
    transition={pageTransition}
    style={{ width: '100%', height: '100%' }}
  >
    {children}
  </motion.div>
);

export default PageTransition;

