<?php

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

Route::redirect('/', 'https://github.com/benborgers/opensheet#readme');

Route::get('{id}/{sheet}', function ($id, $sheet) {
    function error($message)
    {
        abort(response()->json([
            'error' => $message,
        ], 400));
    }

    function look_up_numeric_sheet($sheet, $id)
    {
        if (! is_numeric($sheet)) {
            return $sheet;
        }

        if (intval($sheet) <= 0) {
            error('For this API, sheet numbers start at 1');
        }

        $json = Http::get("https://sheets.googleapis.com/v4/spreadsheets/{$id}?key=".config('services.google.key'))->json();
        if (array_key_exists('error', $json)) {
            error($json['error']['message']);
        }

        $sheetWithIndex = $json['sheets'][intval($sheet) - 1] ?? null;
        if (! $sheetWithIndex) {
            error("There is no sheet number {$sheet}");
        }

        return $sheetWithIndex['properties']['title'];
    }

    $data = Cache::remember("{$id}/{$sheet}", app()->isLocal() ? 0 : 30, function () use ($id, $sheet) {
        $sheet = preg_replace('/\+/', ' ', $sheet);
        $sheet = look_up_numeric_sheet($sheet, $id);

        $json = Http::get("https://sheets.googleapis.com/v4/spreadsheets/{$id}/values/{$sheet}?key=".config('services.google.key'))->json();
        if (array_key_exists('error', $json)) {
            error($json['error']['message']);
        }

        $output = [];

        $rows = $json['values'] ?? [];
        $headers = array_shift($rows);

        foreach ($rows as $row) {
            $min = min(count($headers), count($row));
            $output[] = array_combine(array_slice($headers, 0, $min), array_slice($row, 0, $min));
        }

        return $output;
    });

    return response()->json($data);
});

Route::get('{any}', function () {
    return response()->json([
        'error' => 'URL format is /spreadsheet_id/sheet_name',
    ], 404);
})->where('any', '.*');
