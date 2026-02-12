import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  priority?: boolean
  showText?: boolean
}

const sizeConfig = {
  sm: {
    width: 24,
    height: 24,
    textClass: 'text-base'
  },
  md: {
    width: 32,
    height: 32,
    textClass: 'text-xl'
  },
  lg: {
    width: 48,
    height: 48,
    textClass: 'text-2xl'
  },
  xl: {
    width: 64,
    height: 64,
    textClass: 'text-3xl'
  }
}

export function Logo({
  size = 'md',
  className,
  priority = false,
  showText = true
}: LogoProps) {
  const config = sizeConfig[size]

  return (
    <div className={cn(
      'flex items-center gap-2',
      className
    )}>
      <Image
        src="/Aletheia.png"
        alt="Aletheia Logo"
        width={config.width}
        height={config.height}
        priority={priority}
        className="rounded-lg"
      />
      {showText && (
        <span className={cn(
          'font-eagle-lake text-ascendia-accent',
          config.textClass
        )}>
          Ascendia
        </span>
      )}
    </div>
  )
}