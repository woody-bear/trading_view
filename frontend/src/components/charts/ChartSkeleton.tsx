export default function ChartSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="h-[450px] bg-gray-800 animate-pulse rounded-t-lg" />
      <div className="h-[110px] bg-gray-800 animate-pulse" />
      <div className="h-[110px] bg-gray-800 animate-pulse rounded-b-lg" />
    </div>
  )
}
