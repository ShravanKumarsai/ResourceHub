'use client'

import { Toaster as Sonner, type ToasterProps } from 'sonner'

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          '--normal-bg': '#ffffff',
          '--normal-text': '#182b3a',
          '--normal-border': '#dce4ea',
          '--border-radius': '10px',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
