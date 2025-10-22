import { useEffect, useRef } from "react";
import CountUp from "react-countup";
import { cn } from "@/lib/utils";

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
  className?: string;
  separator?: string;
}

export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  decimals = 2,
  duration = 1,
  className,
  separator = ","
}: AnimatedCounterProps) {
  const prevValue = useRef(value);

  useEffect(() => {
    prevValue.current = value;
  }, [value]);

  return (
    <CountUp
      start={prevValue.current}
      end={value}
      duration={duration}
      decimals={decimals}
      prefix={prefix}
      suffix={suffix}
      separator={separator}
      preserveValue
      className={cn("font-mono", className)}
    />
  );
}
