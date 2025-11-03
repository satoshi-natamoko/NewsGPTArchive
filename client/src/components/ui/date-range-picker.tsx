import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DateRangePickerProps {
  date?: DateRange;
  onDateChange?: (date: DateRange | undefined) => void;
  className?: string;
  availableDates?: string[];
}

export function DateRangePicker({
  date,
  onDateChange,
  className,
  availableDates = [],
}: DateRangePickerProps) {
  const disabledMatcher = availableDates.length > 0 
    ? (day: Date) => {
        const dateStr = format(day, "yyyy-MM-dd");
        return !availableDates.includes(dateStr);
      }
    : undefined;

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant={"outline"}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground"
            )}
            data-testid="button-date-range-picker"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, "yyyy.MM.dd")} - {format(date.to, "yyyy.MM.dd")}
                </>
              ) : (
                format(date.from, "yyyy.MM.dd")
              )
            ) : (
              <span>날짜를 선택하세요</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 bg-card" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={onDateChange}
            numberOfMonths={2}
            className="text-foreground"
            disabled={disabledMatcher}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
