import { RecordFilterFunction, Record, RecordMapFunction } from "./global";

export class RecordStream {
  static filter(fn: RecordFilterFunction): Serializable
  static map(fn: RecordMapFunction): Serializable
  static recordMapStream(record: Record, noeval?: boolean): Serializable
  filter(fn: RecordFilterFunction): RecordStream
  map(fn: RecordFilterFunction): RecordStream
}

export class Serializable extends RecordStream {}

export class Parsable extends RecordStream {}