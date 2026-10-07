-- Heuristic rank of the chosen option, logged separately from chosen_rank (the
-- displayed rank) so a learned ranker can be compared against the heuristic.
-- Under the priority in route_choices.priority. Null for rows logged before
-- this column existed. route_requests.options[] gains `heuristic_rank` the
-- same way (jsonb, no schema change).

alter table public.route_choices
  add column heuristic_rank smallint check (heuristic_rank >= 1);

comment on column public.route_choices.heuristic_rank is
  'Rank of the chosen option under the scoring heuristic for `priority` (chosen_rank is the displayed rank).';
