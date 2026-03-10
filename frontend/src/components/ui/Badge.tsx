import React from 'react'
import clsx from 'clsx'

type BadgeVariant = 'green' | 'red' | 'yellow' | 'blue' | 'gray' | 'indigo'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variants: Record<BadgeVariant, string> = {
  green: 'bg-green-100 text-green-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  blue: 'bg-blue-100 text-blue-800',
  gray: 'bg-gray-100 text-gray-700',
  indigo: 'bg-indigo-100 text-indigo-800',
}

export default function Badge({ variant = 'gray', children, className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  )
}

export function ExamStatusBadge({ status }: { status: string }) {
  if (status === 'DRAFT') return <Badge variant="yellow">Borrador</Badge>
  if (status === 'PUBLISHED') return <Badge variant="blue">Publicado</Badge>
  if (status === 'CLOSED') return <Badge variant="gray">Cerrado</Badge>
  return <Badge>{status}</Badge>
}

export function EvalStatusBadge({ status }: { status: string }) {
  if (status === 'DRAFT') return <Badge variant="yellow">Borrador</Badge>
  if (status === 'FINAL') return <Badge variant="green">Final</Badge>
  return <Badge>{status}</Badge>
}

export function ApprovedBadge({ approved }: { approved: boolean | null }) {
  if (approved === null) return <Badge variant="gray">Sin datos</Badge>
  return approved ? (
    <Badge variant="green">Aprobado</Badge>
  ) : (
    <Badge variant="red">Reprobado</Badge>
  )
}
