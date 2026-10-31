import Image from 'next/image'

export function ResourceImage({
  src,
  alt,
  sizes,
  className,
}: {
  src?: string | null
  alt: string
  sizes: string
  className?: string
}) {
  return (
    <Image
      src={src || '/images/resource-placeholder.svg'}
      alt={alt}
      fill
      sizes={sizes}
      className={className ?? 'object-cover'}
      unoptimized
    />
  )
}
