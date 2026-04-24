import * as React from "react";
import { cn } from "@/lib/utils";

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

const Tabs = React.forwardRef<HTMLDivElement, TabsProps>(
  ({ className, defaultValue, value, onValueChange, ...props }, ref) => {
    const tabsRef = React.useRef<HTMLDivElement>(null);
    
    // When the component mounts or onValueChange changes,
    // store the callback function on the DOM element
    React.useEffect(() => {
      if (tabsRef.current && onValueChange) {
        // @ts-ignore - storing the function on the DOM element
        tabsRef.current.__tabsOnValueChange = onValueChange;
      }
    }, [onValueChange]);
    
    return (
      <div
        ref={(node) => {
          // Merge the refs
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            // Use mutable version of React.Ref
            (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }
          tabsRef.current = node;
        }}
        className={cn("space-y-4", className)}
        data-state={value ? "controlled" : "uncontrolled"}
        data-value={value || defaultValue}
        {...props}
      />
    );
  }
);
Tabs.displayName = "Tabs";

interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {}

const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        className
      )}
      {...props}
    />
  )
);
TabsList.displayName = "TabsList";

interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  value: string;
}

const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, active, value, onClick, ...props }, ref) => {
    // Find parent Tabs component to access its onValueChange
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      // Find closest parent with onValueChange function
      let el = e.currentTarget.parentElement;
      while (el) {
        // @ts-ignore - accessing __tabsOnValueChange
        if (el.__tabsOnValueChange) {
          // @ts-ignore - call the function with our value
          el.__tabsOnValueChange(value);
          break;
        }
        el = el.parentElement;
      }
      
      // Also call the original onClick if provided
      if (onClick) {
        onClick(e);
      }
    };
    
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          active
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
          className
        )}
        onClick={handleClick}
        data-tab-value={value}
        {...props}
      />
    );
  }
);
TabsTrigger.displayName = "TabsTrigger";

interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
      {...props}
    />
  )
);
TabsContent.displayName = "TabsContent";

export { Tabs, TabsList, TabsTrigger, TabsContent }; 