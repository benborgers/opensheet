<?php

namespace App\Support;
use Illuminate\Support\Facades\Http;

class Helpers {
    public static function error($message)
    {
        abort(response()->json([
            'error' => $message,
        ], 400));
    }

    public static function look_up_numeric_sheet($sheet, $id)
    {
        if (! is_numeric($sheet)) {
            return $sheet;
        }

        if (intval($sheet) <= 0) {
            self::error('For this API, sheet numbers start at 1');
        }

        $json = Http::get("https://sheets.googleapis.com/v4/spreadsheets/{$id}?key=".config('services.google.key'))->json();
        if (array_key_exists('error', $json)) {
            self::error($json['error']['message']);
        }

        $sheetWithIndex = $json['sheets'][intval($sheet) - 1] ?? null;
        if (! $sheetWithIndex) {
            self::error("There is no sheet number {$sheet}");
        }

        return $sheetWithIndex['properties']['title'];
    }
}
