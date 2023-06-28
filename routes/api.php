<?php

use App\Support\Helpers;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Route;

Route::redirect('/', 'https://github.com/benborgers/opensheet#readme');

Route::get('{id}/{sheet}', function ($id, $sheet) {
    $data = Cache::remember("{$id}/{$sheet}", app()->isLocal() ? 0 : 30, function () use ($id, $sheet) {
        $sheet = preg_replace('/\+/', ' ', $sheet);
        $sheet = Helpers::look_up_numeric_sheet($sheet, $id);

        $json = Http::get("https://sheets.googleapis.com/v4/spreadsheets/{$id}/values/{$sheet}?key=".config('services.google.key'))->json();
        if (array_key_exists('error', $json)) {
            Helpers::error($json['error']['message']);
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
