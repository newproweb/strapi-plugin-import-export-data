import React from "react";

import {
  Grid, Field, Searchbar, Button, SingleSelect, SingleSelectOption, TextInput, Box,
} from "@strapi/design-system";

const DateOrLocaleField = ({ collection, status, setStatus, locale, setLocale, locales }) => {
  if (collection?.draftAndPublish) {
    return (
      <Field.Root name="status">
        <Field.Label>Status</Field.Label>
        <SingleSelect value={status} onChange={setStatus}>
          <SingleSelectOption value="published">Published</SingleSelectOption>
          <SingleSelectOption value="draft">Draft</SingleSelectOption>
        </SingleSelect>
      </Field.Root>
    );
  }
  if (collection?.hasI18n && locales.length > 0) {
    return (
      <Field.Root name="locale">
        <Field.Label>Locale</Field.Label>
        <SingleSelect value={locale} onChange={setLocale} placeholder="All">
          {locales.map((l) => (
            <SingleSelectOption key={l.code} value={l.code}>{l.name || l.code}</SingleSelectOption>
          ))}
        </SingleSelect>
      </Field.Root>
    );
  }
  return <Box />;
};

const FilterBar = ({
  search, setSearch, onSearchSubmit,
  dateField, setDateField, dateFieldOptions,
  dateFrom, setDateFrom, dateTo, setDateTo,
  sortField, setSortField, columns,
  sortOrder, setSortOrder,
  collection, status, setStatus, locale, setLocale, locales,
}) => (
  <Grid.Root gap={3} marginBottom={3}>
    <Grid.Item col={9} s={12} direction="column" alignItems="stretch">
      <Field.Root name="search">
        <Field.Label>Search</Field.Label>
        <Searchbar
          name="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClear={() => setSearch("")}
          clearLabel="Clear"
          placeholder="Search string fields…"
          onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
        >
          Search
        </Searchbar>
        <Field.Hint>Matches against every string / text field on the collection.</Field.Hint>
      </Field.Root>
    </Grid.Item>
    <Grid.Item col={3} s={12} direction="column" alignItems="stretch" justifyContent="end">
      <Button variant="secondary" onClick={onSearchSubmit} fullWidth>Apply filters</Button>
    </Grid.Item>

    <Grid.Item col={4} s={12} direction="column" alignItems="stretch">
      <Field.Root name="dateField">
        <Field.Label>Date field</Field.Label>
        <SingleSelect value={dateField} onChange={setDateField}>
          {dateFieldOptions.map((k) => (
            <SingleSelectOption key={k} value={k}>{k}</SingleSelectOption>
          ))}
        </SingleSelect>
      </Field.Root>
    </Grid.Item>
    <Grid.Item col={4} s={12} direction="column" alignItems="stretch">
      <Field.Root name="dateFrom">
        <Field.Label>From</Field.Label>
        <TextInput type="date" value={dateFrom || ""} onChange={(e) => setDateFrom(e.target.value || null)} />
      </Field.Root>
    </Grid.Item>
    <Grid.Item col={4} s={12} direction="column" alignItems="stretch">
      <Field.Root name="dateTo">
        <Field.Label>To</Field.Label>
        <TextInput type="date" value={dateTo || ""} onChange={(e) => setDateTo(e.target.value || null)} />
      </Field.Root>
    </Grid.Item>

    <Grid.Item col={4} s={12} direction="column" alignItems="stretch">
      <Field.Root name="sortField">
        <Field.Label>Sort by</Field.Label>
        <SingleSelect value={sortField} onChange={setSortField} placeholder="None">
          {columns.map((c) => (
            <SingleSelectOption key={c} value={c}>{c}</SingleSelectOption>
          ))}
        </SingleSelect>
      </Field.Root>
    </Grid.Item>
    <Grid.Item col={4} s={12} direction="column" alignItems="stretch">
      <Field.Root name="sortOrder">
        <Field.Label>Order</Field.Label>
        <SingleSelect value={sortOrder} onChange={setSortOrder}>
          <SingleSelectOption value="asc">Ascending</SingleSelectOption>
          <SingleSelectOption value="desc">Descending</SingleSelectOption>
        </SingleSelect>
      </Field.Root>
    </Grid.Item>
    <Grid.Item col={4} s={12} direction="column" alignItems="stretch">
      <DateOrLocaleField
        collection={collection}
        status={status}
        setStatus={setStatus}
        locale={locale}
        setLocale={setLocale}
        locales={locales}
      />
    </Grid.Item>
  </Grid.Root>
);

export default FilterBar;
