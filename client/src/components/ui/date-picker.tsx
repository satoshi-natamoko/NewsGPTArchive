import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  availableDates?: string[];
  className?: string;
  "data-testid"?: string;
}

export function DatePicker({
  date,
  onDateChange,
  availableDates = [],
  className,
  "data-testid": testId,
}: DatePickerProps) {
  const availableDateSet = new Set(availableDates);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className
          )}
          data-testid={testId}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "yyyy년 M월 d일", { locale: ko }) : "날짜 선택"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <Calendar
          mode="single"
          selected={date}
          onSelect={onDateChange}
          locale={ko}
          showOutsideDays={false}
          modifiers={{
            available: (day) => {
              const dateStr = format(day, "yyyy-MM-dd");
              return availableDateSet.has(dateStr);
            },
          }}
          modifiersClassNames={{
            available: "font-bold text-primary bg-primary/10 hover:bg-primary/20",
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
