import { Skeleton } from "@/components/ui/skeleton";

const LoadingSpinner = () => {
  return (
    <div className="flex items-center justify-center p-12">
      <div className="w-full max-w-md space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-[250px]" />
          <Skeleton className="h-4 w-[200px]" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner;