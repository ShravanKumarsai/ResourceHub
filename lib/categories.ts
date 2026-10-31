import {
  Bot,
  CircuitBoard,
  Cpu,
  Factory,
  FlaskConical,
  Gauge,
  Ruler,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import type { Category } from './types'

export const CATEGORY_ICON: Record<string, LucideIcon> = {
  'Robotics and automation': Bot,
  'Manufacturing and fabrication': Factory,
  'Electronics and embedded systems': CircuitBoard,
  'Materials testing': Gauge,
  'Computing and simulation': Cpu,
  'Research laboratories': FlaskConical,
  'Measurement and instrumentation': Ruler,
  'Technical workspaces': Warehouse,
}

export const CATEGORY_BLURB: Record<string, string> = {
  'Robotics and automation': 'Manipulators, mobile platforms, and motion control rigs',
  'Manufacturing and fabrication': 'CNC machining, additive manufacturing, and workshops',
  'Electronics and embedded systems': 'Instrumented benches for hardware and firmware work',
  'Materials testing': 'Mechanical characterisation to recognised standards',
  'Computing and simulation': 'GPU clusters and engineering simulation capacity',
  'Research laboratories': 'Microscopy, spectroscopy, and characterisation suites',
  'Measurement and instrumentation': 'Metrology and precision measurement systems',
  'Technical workspaces': 'Bookable studios and shared engineering spaces',
}
